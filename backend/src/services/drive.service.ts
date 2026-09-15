import crypto from "node:crypto";
import { env } from "../config/env";
import { getSupabaseServiceClient } from "../config/database";
import { AppError } from "../utils/AppError";

const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
const assertConfigured = () => {
    if (!env.google.clientId || !env.google.clientSecret || !env.google.tokenEncryptionKey || !env.google.oauthStateSecret) {
        throw new AppError("Google Drive integration is not configured", 503, "DRIVE_NOT_CONFIGURED");
    }
};
const key = () => crypto.createHash("sha256").update(env.google.tokenEncryptionKey).digest();
const encrypt = (value: string) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
};
const decrypt = (value: string) => {
    const [iv, tag, data] = value.split(".");
    if (!iv || !tag || !data) throw new AppError("Stored Drive token is invalid", 503, "DRIVE_TOKEN_INVALID");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
};
const sign = (payload: string) => crypto.createHmac("sha256", env.google.oauthStateSecret).update(payload).digest("base64url");
const userFromState = (state: string) => {
    const [payload, signature] = state.split(".");
    const expected = payload ? sign(payload) : "";
    if (!payload || !signature || signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        throw new AppError("Google authorization state is invalid", 400, "DRIVE_OAUTH_STATE_INVALID");
    }
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId: string; expiresAt: number };
    if (!value.userId || value.expiresAt < Date.now()) throw new AppError("Google authorization state has expired", 400, "DRIVE_OAUTH_STATE_EXPIRED");
    return value.userId;
};
const json = async <T>(url: string, init: RequestInit): Promise<T> => {
    const response = await fetch(url, init);
    if (!response.ok) throw new AppError(response.status === 401 ? "Google authorization has expired or been revoked" : "Google Drive request failed", response.status === 401 ? 401 : 502, response.status === 401 ? "DRIVE_AUTH_REVOKED" : "DRIVE_REQUEST_FAILED");
    return (await response.json()) as T;
};
type Token = { access_token: string; refresh_token?: string; expires_in?: number };
type File = { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; webViewLink?: string; trashed?: boolean };
type Connection = { encrypted_access_token: string; encrypted_refresh_token: string; access_token_expires_at: string };
const connection = async (userId: string) => {
    const result = await getSupabaseServiceClient().from("google_drive_connections").select("encrypted_access_token, encrypted_refresh_token, access_token_expires_at").eq("user_id", userId).maybeSingle();
    if (result.error || !result.data) throw new AppError("Google Drive account is not connected", 401, "DRIVE_NOT_CONNECTED");
    return result.data as Connection;
};
const accessToken = async (userId: string) => {
    const stored = await connection(userId);
    if (new Date(stored.access_token_expires_at).getTime() > Date.now() + 60000) return decrypt(stored.encrypted_access_token);
    const token = await json<Token>(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.google.clientId, client_secret: env.google.clientSecret, refresh_token: decrypt(stored.encrypted_refresh_token), grant_type: "refresh_token" }) });
    await getSupabaseServiceClient().from("google_drive_connections").update({ encrypted_access_token: encrypt(token.access_token), access_token_expires_at: new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString() }).eq("user_id", userId);
    return token.access_token;
};
export const createAuthorizationUrl = (userId: string) => {
    assertConfigured();
    const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 600000 })).toString("base64url");
    const params = new URLSearchParams({ client_id: env.google.clientId, redirect_uri: env.google.redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope: SCOPES.join(" "), state: `${payload}.${sign(payload)}` });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};
export const completeAuthorization = async (state: string, code: string) => {
    assertConfigured();
    const userId = userFromState(state);
    const token = await json<Token>(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: env.google.clientId, client_secret: env.google.clientSecret, redirect_uri: env.google.redirectUri, grant_type: "authorization_code" }) });
    if (!token.refresh_token) throw new AppError("Google did not return a refresh token", 502, "DRIVE_REFRESH_TOKEN_MISSING");
    const result = await getSupabaseServiceClient().from("google_drive_connections").upsert({ user_id: userId, encrypted_access_token: encrypt(token.access_token), encrypted_refresh_token: encrypt(token.refresh_token), access_token_expires_at: new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString(), scopes: SCOPES }, { onConflict: "user_id" });
    if (result.error) throw new AppError("Unable to securely store Google authorization", 503, "DRIVE_TOKEN_STORAGE_FAILED");
    return userId;
};
export const listFiles = async (userId: string, pageToken?: string) => {
    const params = new URLSearchParams({ fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,trashed)", pageSize: "50", q: "trashed = false" });
    if (pageToken) params.set("pageToken", pageToken);
    return json<{ files: File[]; nextPageToken?: string }>(`${DRIVE_API}/files?${params}`, { headers: { Authorization: `Bearer ${await accessToken(userId)}` } });
};
export const getFileMetadata = async (userId: string, fileId: string) => json<File>(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,webViewLink,trashed`, { headers: { Authorization: `Bearer ${await accessToken(userId)}` } });
export const getFileContent = async (userId: string, fileId: string) => {
    const file = await getFileMetadata(userId, fileId);
    if (!["text/plain", "text/markdown", "application/vnd.google-apps.document"].includes(file.mimeType)) throw new AppError("This Drive file type is not supported", 415, "DRIVE_FILE_TYPE_UNSUPPORTED");
    const url = file.mimeType === "application/vnd.google-apps.document" ? `${DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain` : `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(userId)}` } });
    if (!response.ok) throw new AppError(response.status === 401 ? "Google authorization has expired or been revoked" : "Unable to read Drive file content", response.status === 401 ? 401 : 502, response.status === 401 ? "DRIVE_AUTH_REVOKED" : "DRIVE_CONTENT_FAILED");
    if (Number(response.headers.get("content-length") || 0) > MAX_CONTENT_BYTES) throw new AppError("Drive file is too large to read", 413, "DRIVE_CONTENT_TOO_LARGE");
    const content = await response.text();
    if (Buffer.byteLength(content) > MAX_CONTENT_BYTES) throw new AppError("Drive file is too large to read", 413, "DRIVE_CONTENT_TOO_LARGE");
    return { file, content };
};
