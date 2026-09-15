"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.synchronizeDriveKnowledge = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const database_1 = require("../config/database");
const AppError_1 = require("../utils/AppError");
const embedding_service_1 = require("../memory/embedding.service");
const drive_service_1 = require("./drive.service");
const embeddingProvider = new embedding_service_1.GeminiEmbeddingProvider();
const CHUNK_SIZE = 6000;
const CHUNK_OVERLAP = 500;
const hash = (value) => node_crypto_1.default.createHash("sha256").update(value).digest("hex");
const chunkDocument = (content) => {
    const normalized = content.replace(/\r\n/g, "\n").trim();
    const chunks = [];
    let start = 0;
    while (start < normalized.length) {
        const end = Math.min(start + CHUNK_SIZE, normalized.length);
        const chunk = normalized.slice(start, end).trim();
        if (chunk)
            chunks.push(chunk);
        if (end === normalized.length)
            break;
        start = end - CHUNK_OVERLAP;
    }
    return chunks;
};
const supported = (file) => ["text/plain", "text/markdown", "application/vnd.google-apps.document"].includes(file.mimeType);
const assertUser = (userId) => {
    if (!userId)
        throw new AppError_1.AppError("Authenticated user is required", 401, "AUTH_REQUIRED");
};
const syncPage = async (userId, pageToken) => {
    const result = await (0, drive_service_1.listFiles)(userId, pageToken);
    const files = result.files || [];
    if (result.nextPageToken) {
        return files.concat(await syncPage(userId, result.nextPageToken));
    }
    return files;
};
const synchronizeDriveKnowledge = async (userId) => {
    assertUser(userId);
    const client = (0, database_1.getSupabaseServiceClient)();
    const files = await syncPage(userId);
    const seenIds = new Set(files.map((file) => file.id));
    const result = {
        discovered: files.length,
        ingested: 0,
        unchanged: 0,
        unsupported: 0,
        deleted: 0,
        failed: 0
    };
    for (const file of files) {
        const existingResult = await client
            .from("drive_documents")
            .select("id, content_hash, drive_modified_at, status")
            .eq("user_id", userId)
            .eq("drive_file_id", file.id)
            .maybeSingle();
        if (existingResult.error)
            throw new AppError_1.AppError(existingResult.error.message, 400, "DRIVE_SYNC_DATABASE_ERROR");
        if (!supported(file)) {
            await client.from("drive_documents").upsert({
                user_id: userId,
                drive_file_id: file.id,
                filename: file.name,
                mime_type: file.mimeType,
                drive_modified_at: file.modifiedTime || null,
                content_hash: hash(`${file.id}:${file.modifiedTime || ""}`),
                status: "unsupported",
                metadata: { size: file.size, webViewLink: file.webViewLink }
            }, { onConflict: "user_id,drive_file_id" });
            result.unsupported++;
            continue;
        }
        const unchanged = existingResult.data &&
            existingResult.data.status === "active" &&
            existingResult.data.drive_modified_at === (file.modifiedTime || null);
        if (unchanged) {
            result.unchanged++;
            continue;
        }
        try {
            const extracted = await (0, drive_service_1.getFileContent)(userId, file.id);
            const documentHash = hash(extracted.content);
            if (existingResult.data?.content_hash === documentHash && existingResult.data.status === "active") {
                result.unchanged++;
                continue;
            }
            const documentResult = await client.from("drive_documents").upsert({
                user_id: userId,
                drive_file_id: file.id,
                filename: file.name,
                mime_type: file.mimeType,
                drive_modified_at: file.modifiedTime || null,
                content_hash: documentHash,
                status: "active",
                metadata: { size: file.size, webViewLink: file.webViewLink },
                last_ingested_at: new Date().toISOString()
            }, { onConflict: "user_id,drive_file_id" }).select("id").single();
            if (documentResult.error || !documentResult.data)
                throw new Error(documentResult.error?.message || "Unable to save Drive document");
            await client.from("drive_document_chunks").delete()
                .eq("user_id", userId)
                .eq("document_id", documentResult.data.id);
            const chunks = chunkDocument(extracted.content);
            for (let index = 0; index < chunks.length; index++) {
                const embedding = await embeddingProvider.generateEmbedding(chunks[index]);
                if (embedding.dimensions !== 768) {
                    throw new Error("Embedding dimensions do not match drive chunk schema");
                }
                const chunkResult = await client.from("drive_document_chunks").insert({
                    user_id: userId,
                    document_id: documentResult.data.id,
                    chunk_index: index,
                    content: chunks[index],
                    content_hash: hash(chunks[index]),
                    embedding_provider: embedding.provider,
                    embedding_model: embedding.model,
                    embedding_dimensions: embedding.dimensions,
                    embedding: `[${embedding.vector.join(",")}]`,
                    metadata: { startChunk: index, totalChunks: chunks.length }
                });
                if (chunkResult.error)
                    throw new Error(chunkResult.error.message);
            }
            result.ingested++;
        }
        catch (_error) {
            await client.from("drive_documents").upsert({
                user_id: userId,
                drive_file_id: file.id,
                filename: file.name,
                mime_type: file.mimeType,
                drive_modified_at: file.modifiedTime || null,
                content_hash: hash(`${file.id}:${file.modifiedTime || ""}`),
                status: "failed",
                metadata: { size: file.size, webViewLink: file.webViewLink }
            }, { onConflict: "user_id,drive_file_id" });
            result.failed++;
        }
    }
    const existing = await client
        .from("drive_documents")
        .select("id, drive_file_id")
        .eq("user_id", userId)
        .eq("status", "active");
    if (existing.error)
        throw new AppError_1.AppError(existing.error.message, 400, "DRIVE_SYNC_DATABASE_ERROR");
    const removed = (existing.data || []).filter((doc) => !seenIds.has(doc.drive_file_id));
    for (const doc of removed) {
        await client.from("drive_documents")
            .update({ status: "deleted" })
            .eq("id", doc.id)
            .eq("user_id", userId);
        result.deleted++;
    }
    return result;
};
exports.synchronizeDriveKnowledge = synchronizeDriveKnowledge;
//# sourceMappingURL=drive-ingestion.service.js.map