"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMemoryCandidate = exports.deleteMemory = exports.updateMemory = exports.searchMemories = exports.listMemories = exports.createMemory = void 0;
const database_1 = require("../config/database");
const memory_types_1 = require("../memory/memory.types");
const AppError_1 = require("../utils/AppError");
const embedding_service_1 = require("../memory/embedding.service");
const memory_repository_1 = require("../memory/memory.repository");
const SECRET_PATTERN = /\b(password|passcode|api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|otp|one[\s_-]?time[\s_-]?password|cvv|card number|private key|secret)\b/i;
const dbError = (message) => { throw new AppError_1.AppError(message, 400, "MEMORY_DATABASE_ERROR"); };
const contentOf = (content) => {
    const value = content.trim();
    if (!value || value.length > 65536)
        throw new AppError_1.AppError("Memory content must be between 1 and 65536 characters", 400, "MEMORY_CONTENT_INVALID");
    if (SECRET_PATTERN.test(value))
        throw new AppError_1.AppError("Sensitive credentials cannot be stored as memory", 400, "MEMORY_SENSITIVE_CONTENT");
    return value;
};
const categoryOf = (category) => {
    if (!memory_types_1.MEMORY_CATEGORIES.includes(category))
        throw new AppError_1.AppError("Memory category is invalid", 400, "MEMORY_CATEGORY_INVALID");
    return category;
};
const importanceOf = (importance) => {
    const value = importance ?? 50;
    if (!Number.isInteger(value) || value < 0 || value > 100)
        throw new AppError_1.AppError("Memory importance must be an integer between 0 and 100", 400, "MEMORY_IMPORTANCE_INVALID");
    return value;
};
const embeddingProvider = new embedding_service_1.GeminiEmbeddingProvider();
const createMemory = async (token, userId, input) => {
    const content = contentOf(input.content);
    const category = categoryOf(input.category);
    const client = (0, database_1.getSupabaseClientForAccessToken)(token);
    const duplicate = await client.from("memories").select("id").eq("user_id", userId).eq("memory_type", category).eq("content", content).is("expires_at", null).maybeSingle();
    if (duplicate.error)
        dbError(duplicate.error.message);
    if (duplicate.data)
        throw new AppError_1.AppError("An equivalent memory already exists", 409, "MEMORY_DUPLICATE");
    const result = await client.from("memories").insert({
        user_id: userId, memory_type: category, content, importance: importanceOf(input.importance),
        source: input.source || "user", source_conversation_id: input.sourceConversationId,
        source_message_id: input.sourceMessageId, expires_at: input.expiresAt || null
    }).select("*").single();
    if (result.error || !result.data)
        dbError(result.error?.message || "Unable to create memory");
    const memory = result.data;
    const embedding = await embeddingProvider.generateEmbedding(content);
    await (0, memory_repository_1.saveMemoryEmbedding)(token, userId, memory.id, 1, embedding);
    return memory;
};
exports.createMemory = createMemory;
const listMemories = async (token, userId, category) => {
    const client = (0, database_1.getSupabaseClientForAccessToken)(token);
    let query = client.from("memories").select("*").eq("user_id", userId)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .order("importance", { ascending: false }).order("updated_at", { ascending: false });
    if (category)
        query = query.eq("memory_type", categoryOf(category));
    const result = await query;
    if (result.error)
        dbError(result.error.message);
    return (result.data || []);
};
exports.listMemories = listMemories;
const searchMemories = async (token, userId, text, category) => {
    const queryText = text.trim();
    if (!queryText || queryText.length > 200)
        throw new AppError_1.AppError("Memory search query is invalid", 400, "MEMORY_SEARCH_INVALID");
    const client = (0, database_1.getSupabaseClientForAccessToken)(token);
    let query = client.from("memories").select("*").eq("user_id", userId).ilike("content", `%${queryText}%`)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString()).order("importance", { ascending: false }).limit(50);
    if (category)
        query = query.eq("memory_type", categoryOf(category));
    const result = await query;
    if (result.error)
        dbError(result.error.message);
    return (result.data || []);
};
exports.searchMemories = searchMemories;
const updateMemory = async (token, userId, memoryId, input) => {
    const updates = {};
    if (input.content !== undefined)
        updates.content = contentOf(input.content);
    if (input.category !== undefined)
        updates.memory_type = categoryOf(input.category);
    if (input.importance !== undefined)
        updates.importance = importanceOf(input.importance);
    if (input.expiresAt !== undefined)
        updates.expires_at = input.expiresAt;
    if (!Object.keys(updates).length)
        throw new AppError_1.AppError("No memory changes supplied", 400, "MEMORY_UPDATE_INVALID");
    const result = await (0, database_1.getSupabaseClientForAccessToken)(token).from("memories").update(updates).eq("id", memoryId).eq("user_id", userId).select("*").single();
    if (result.error || !result.data)
        throw new AppError_1.AppError("Memory not found", 404, "MEMORY_NOT_FOUND");
    const memory = result.data;
    if (input.content !== undefined || input.category !== undefined) {
        const embedding = await embeddingProvider.generateEmbedding(memory.content);
        await (0, memory_repository_1.saveMemoryEmbedding)(token, userId, memory.id, 1, embedding);
    }
    return memory;
};
exports.updateMemory = updateMemory;
const deleteMemory = async (token, userId, memoryId) => {
    const result = await (0, database_1.getSupabaseClientForAccessToken)(token).from("memories").delete().eq("id", memoryId).eq("user_id", userId);
    if (result.error)
        dbError(result.error.message);
};
exports.deleteMemory = deleteMemory;
const extractMemoryCandidate = (content) => {
    const value = content.trim();
    if (!value || value.length > 2000 || SECRET_PATTERN.test(value))
        return null;
    const signals = [
        { category: "preference", pattern: /\b(i prefer|i like|i dislike|please always)\b/i },
        { category: "goal", pattern: /\b(my goal|i want to|i plan to|i need to)\b/i },
        { category: "project", pattern: /\b(i am working on|i'm working on|my project)\b/i },
        { category: "learning", pattern: /\b(i am learning|i'm learning|i learned)\b/i },
        { category: "personal_context", pattern: /\b(i live|i work|my name is|i am a)\b/i },
        { category: "important_fact", pattern: /\b(remember that|important:)\b/i },
        { category: "instruction", pattern: /\b(from now on|when you respond|always do)\b/i }
    ];
    const signal = signals.find((candidate) => candidate.pattern.test(value));
    return signal ? { category: signal.category, content: value } : null;
};
exports.extractMemoryCandidate = extractMemoryCandidate;
//# sourceMappingURL=memory.service.js.map