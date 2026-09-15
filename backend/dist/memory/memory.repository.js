"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchDriveChunks = exports.searchMemoryEmbeddings = exports.saveMemoryEmbedding = void 0;
const database_1 = require("../config/database");
const AppError_1 = require("../utils/AppError");
const throwDatabaseError = (message) => {
    throw new AppError_1.AppError(message, 400, "MEMORY_DATABASE_ERROR");
};
const saveMemoryEmbedding = async (accessToken, userId, memoryId, contentRevision, embedding) => {
    if (embedding.vector.length === 0 ||
        embedding.vector.some((value) => !Number.isFinite(value))) {
        throw new AppError_1.AppError("Embedding vector is invalid", 400, "EMBEDDING_VECTOR_INVALID");
    }
    const client = (0, database_1.getSupabaseClientForAccessToken)(accessToken);
    const { error } = await client.from("memory_embeddings").upsert({
        user_id: userId,
        memory_id: memoryId,
        content_revision: contentRevision,
        embedding_provider: embedding.provider,
        embedding_model: embedding.model,
        embedding_dimensions: embedding.dimensions,
        embedding: `[${embedding.vector.join(",")}]`
    }, { onConflict: "memory_id,embedding_provider,embedding_model" });
    if (error) {
        throwDatabaseError(error.message);
    }
};
exports.saveMemoryEmbedding = saveMemoryEmbedding;
const searchMemoryEmbeddings = async (accessToken, userId, vector, options = {}) => {
    const threshold = options.threshold ?? 0.72;
    const limit = options.limit ?? 5;
    if (vector.length === 0 ||
        vector.some((value) => !Number.isFinite(value)) ||
        threshold < 0 ||
        threshold > 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 20) {
        throw new AppError_1.AppError("Semantic memory search options are invalid", 400, "MEMORY_SEARCH_OPTIONS_INVALID");
    }
    const { data, error } = await (0, database_1.getSupabaseClientForAccessToken)(accessToken).rpc("match_memories", {
        query_embedding: `[${vector.join(",")}]`,
        match_threshold: threshold,
        match_count: limit,
        requesting_user_id: userId
    });
    if (error) {
        throwDatabaseError(error.message);
    }
    return (data || []);
};
exports.searchMemoryEmbeddings = searchMemoryEmbeddings;
const searchDriveChunks = async (accessToken, userId, vector, threshold = 0.72, limit = 5) => {
    if (vector.length === 0 ||
        vector.some((value) => !Number.isFinite(value)) ||
        threshold < 0 ||
        threshold > 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 20) {
        throw new AppError_1.AppError("Drive semantic search options are invalid", 400, "DRIVE_SEARCH_OPTIONS_INVALID");
    }
    const { data, error } = await (0, database_1.getSupabaseClientForAccessToken)(accessToken).rpc("match_drive_chunks", {
        query_embedding: `[${vector.join(",")}]`,
        match_threshold: threshold,
        match_count: limit,
        requesting_user_id: userId
    });
    if (error)
        throwDatabaseError(error.message);
    return data || [];
};
exports.searchDriveChunks = searchDriveChunks;
//# sourceMappingURL=memory.repository.js.map