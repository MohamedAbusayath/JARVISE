"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileContent = exports.getFileMetadata = exports.listFiles = exports.completeAuthorization = exports.createAuthorizationUrl = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const env_1 = require("../config/env");
const database_1 = require("../config/database");
const AppError_1 = require("../utils/AppError");
const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
const assertConfigured = () => {
    if (!env_1.env.google.clientId || !env_1.env.google.clientSecret || !env_1.env.google.tokenEncryptionKey || !env_1.env.google.oauthStateSecret) {
        throw new AppError_1.AppError("Google Drive integration is not configured", 503, "DRIVE_NOT_CONFIGURED");
    }
};
const key = () => node_crypto_1.default.createHash("sha256").update(env_1.env.google.tokenEncryptionKey).digest();
const encrypt = (value) => {
    const iv = node_crypto_1.default.randomBytes(12);
    const cipher = node_crypto_1.default.createCipheriv("aes-256-gcm", key(), iv);
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
};
const decrypt = (value) => {
    const [iv, tag, data] = value.split(".");
    if (!iv || !tag || !data)
        throw new AppError_1.AppError("Stored Drive token is invalid", 503, "DRIVE_TOKEN_INVALID");
    const decipher = node_crypto_1.default.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
};
const sign = (payload) => node_crypto_1.default.createHmac("sha256", env_1.env.google.oauthStateSecret).update(payload).digest("base64url");
const userFromState = (state) => {
    const [payload, signature] = state.split(".");
    const expected = payload ? sign(payload) : "";
    if (!payload || !signature || signature.length !== expected.length ||
        !node_crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        throw new AppError_1.AppError("Google authorization state is invalid", 400, "DRIVE_OAUTH_STATE_INVALID");
    }
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!value.userId || value.expiresAt < Date.now())
        throw new AppError_1.AppError("Google authorization state has expired", 400, "DRIVE_OAUTH_STATE_EXPIRED");
    return value.userId;
};
const json = async (url, init) => {
    const response = await fetch(url, init);
    if (!response.ok)
        throw new AppError_1.AppError(response.status === 401 ? "Google authorization has expired or been revoked" : "Google Drive request failed", response.status === 401 ? 401 : 502, response.status === 401 ? "DRIVE_AUTH_REVOKED" : "DRIVE_REQUEST_FAILED");
    return (await response.json());
};
const connection = async (userId) => {
    const result = await (0, database_1.getSupabaseServiceClient)().from("google_drive_connections").select("encrypted_access_token, encrypted_refresh_token, access_token_expires_at").eq("user_id", userId).maybeSingle();
    if (result.error || !result.data)
        throw new AppError_1.AppError("Google Drive account is not connected", 401, "DRIVE_NOT_CONNECTED");
    return result.data;
};
const accessToken = async (userId) => {
    const stored = await connection(userId);
    if (new Date(stored.access_token_expires_at).getTime() > Date.now() + 60000)
        return decrypt(stored.encrypted_access_token);
    const token = await json(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env_1.env.google.clientId, client_secret: env_1.env.google.clientSecret, refresh_token: decrypt(stored.encrypted_refresh_token), grant_type: "refresh_token" }) });
    await (0, database_1.getSupabaseServiceClient)().from("google_drive_connections").update({ encrypted_access_token: encrypt(token.access_token), access_token_expires_at: new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString() }).eq("user_id", userId);
    return token.access_token;
};
const createAuthorizationUrl = (userId) => {
    assertConfigured();
    const payload = Buffer.from(JSON.stringify({ userId, expiresAt: Date.now() + 600000 })).toString("base64url");
    const params = new URLSearchParams({ client_id: env_1.env.google.clientId, redirect_uri: env_1.env.google.redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope: SCOPES.join(" "), state: `${payload}.${sign(payload)}` });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};
exports.createAuthorizationUrl = createAuthorizationUrl;
const completeAuthorization = async (state, code) => {
    assertConfigured();
    const userId = userFromState(state);
    const token = await json(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: env_1.env.google.clientId, client_secret: env_1.env.google.clientSecret, redirect_uri: env_1.env.google.redirectUri, grant_type: "authorization_code" }) });
    if (!token.refresh_token)
        throw new AppError_1.AppError("Google did not return a refresh token", 502, "DRIVE_REFRESH_TOKEN_MISSING");
    const result = await (0, database_1.getSupabaseServiceClient)().from("google_drive_connections").upsert({ user_id: userId, encrypted_access_token: encrypt(token.access_token), encrypted_refresh_token: encrypt(token.refresh_token), access_token_expires_at: new Date(Date.now() + (token.expires_in || 3600) * 1000).toISOString(), scopes: SCOPES }, { onConflict: "user_id" });
    if (result.error)
        throw new AppError_1.AppError("Unable to securely store Google authorization", 503, "DRIVE_TOKEN_STORAGE_FAILED");
    return userId;
};
exports.completeAuthorization = completeAuthorization;
const listFiles = async (userId, pageToken) => {
    const params = new URLSearchParams({ fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,trashed)", pageSize: "50", q: "trashed = false" });
    if (pageToken)
        params.set("pageToken", pageToken);
    return json(`${DRIVE_API}/files?${params}`, { headers: { Authorization: `Bearer ${await accessToken(userId)}` } });
};
exports.listFiles = listFiles;
const getFileMetadata = async (userId, fileId) => json(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,webViewLink,trashed`, { headers: { Authorization: `Bearer ${await accessToken(userId)}` } });
exports.getFileMetadata = getFileMetadata;
const getFileContent = async (userId, fileId) => {
    const file = await (0, exports.getFileMetadata)(userId, fileId);
    if (!["text/plain", "text/markdown", "application/vnd.google-apps.document"].includes(file.mimeType))
        throw new AppError_1.AppError("This Drive file type is not supported", 415, "DRIVE_FILE_TYPE_UNSUPPORTED");
    const url = file.mimeType === "application/vnd.google-apps.document" ? `${DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain` : `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken(userId)}` } });
    if (!response.ok)
        throw new AppError_1.AppError(response.status === 401 ? "Google authorization has expired or been revoked" : "Unable to read Drive file content", response.status === 401 ? 401 : 502, response.status === 401 ? "DRIVE_AUTH_REVOKED" : "DRIVE_CONTENT_FAILED");
    if (Number(response.headers.get("content-length") || 0) > MAX_CONTENT_BYTES)
        throw new AppError_1.AppError("Drive file is too large to read", 413, "DRIVE_CONTENT_TOO_LARGE");
    const content = await response.text();
    if (Buffer.byteLength(content) > MAX_CONTENT_BYTES)
        throw new AppError_1.AppError("Drive file is too large to read", 413, "DRIVE_CONTENT_TOO_LARGE");
    return { file, content };
};
exports.getFileContent = getFileContent;
//# sourceMappingURL=drive.service.js.map