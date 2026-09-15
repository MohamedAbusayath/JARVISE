import { getSupabaseClientForAccessToken } from "../config/database";
import { CreateMemoryInput, MEMORY_CATEGORIES, MemoryCategory, MemoryRecord } from "../memory/memory.types";
import { AppError } from "../utils/AppError";
import { GeminiEmbeddingProvider } from "../memory/embedding.service";
import { saveMemoryEmbedding } from "../memory/memory.repository";

const SECRET_PATTERN = /\b(password|passcode|api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|otp|one[\s_-]?time[\s_-]?password|cvv|card number|private key|secret)\b/i;
const dbError = (message: string): never => { throw new AppError(message, 400, "MEMORY_DATABASE_ERROR"); };
const contentOf = (content: string): string => {
    const value = content.trim();
    if (!value || value.length > 65536) throw new AppError("Memory content must be between 1 and 65536 characters", 400, "MEMORY_CONTENT_INVALID");
    if (SECRET_PATTERN.test(value)) throw new AppError("Sensitive credentials cannot be stored as memory", 400, "MEMORY_SENSITIVE_CONTENT");
    return value;
};
const categoryOf = (category: string): MemoryCategory => {
    if (!MEMORY_CATEGORIES.includes(category as MemoryCategory)) throw new AppError("Memory category is invalid", 400, "MEMORY_CATEGORY_INVALID");
    return category as MemoryCategory;
};
const importanceOf = (importance?: number) => {
    const value = importance ?? 50;
    if (!Number.isInteger(value) || value < 0 || value > 100) throw new AppError("Memory importance must be an integer between 0 and 100", 400, "MEMORY_IMPORTANCE_INVALID");
    return value;
};
const embeddingProvider = new GeminiEmbeddingProvider();

export const createMemory = async (token: string, userId: string, input: CreateMemoryInput): Promise<MemoryRecord> => {
    const content = contentOf(input.content);
    const category = categoryOf(input.category);
    const client = getSupabaseClientForAccessToken(token);
    const duplicate = await client.from("memories").select("id").eq("user_id", userId).eq("memory_type", category).eq("content", content).is("expires_at", null).maybeSingle();
    if (duplicate.error) dbError(duplicate.error.message);
    if (duplicate.data) throw new AppError("An equivalent memory already exists", 409, "MEMORY_DUPLICATE");
    const result = await client.from("memories").insert({
        user_id: userId, memory_type: category, content, importance: importanceOf(input.importance),
        source: input.source || "user", source_conversation_id: input.sourceConversationId,
        source_message_id: input.sourceMessageId, expires_at: input.expiresAt || null
    }).select("*").single();
    if (result.error || !result.data) dbError(result.error?.message || "Unable to create memory");
    const memory = result.data as MemoryRecord;
    const embedding = await embeddingProvider.generateEmbedding(content);
    await saveMemoryEmbedding(token, userId, memory.id, 1, embedding);
    return memory;
};

export const listMemories = async (token: string, userId: string, category?: string) => {
    const client = getSupabaseClientForAccessToken(token);
    let query = client.from("memories").select("*").eq("user_id", userId)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .order("importance", { ascending: false }).order("updated_at", { ascending: false });
    if (category) query = query.eq("memory_type", categoryOf(category));
    const result = await query;
    if (result.error) dbError(result.error.message);
    return (result.data || []) as MemoryRecord[];
};

export const searchMemories = async (token: string, userId: string, text: string, category?: string) => {
    const queryText = text.trim();
    if (!queryText || queryText.length > 200) throw new AppError("Memory search query is invalid", 400, "MEMORY_SEARCH_INVALID");
    const client = getSupabaseClientForAccessToken(token);
    let query = client.from("memories").select("*").eq("user_id", userId).ilike("content", `%${queryText}%`)
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString()).order("importance", { ascending: false }).limit(50);
    if (category) query = query.eq("memory_type", categoryOf(category));
    const result = await query;
    if (result.error) dbError(result.error.message);
    return (result.data || []) as MemoryRecord[];
};

export const updateMemory = async (token: string, userId: string, memoryId: string, input: Partial<CreateMemoryInput>) => {
    const updates: Record<string, unknown> = {};
    if (input.content !== undefined) updates.content = contentOf(input.content);
    if (input.category !== undefined) updates.memory_type = categoryOf(input.category);
    if (input.importance !== undefined) updates.importance = importanceOf(input.importance);
    if (input.expiresAt !== undefined) updates.expires_at = input.expiresAt;
    if (!Object.keys(updates).length) throw new AppError("No memory changes supplied", 400, "MEMORY_UPDATE_INVALID");
    const result = await getSupabaseClientForAccessToken(token).from("memories").update(updates).eq("id", memoryId).eq("user_id", userId).select("*").single();
    if (result.error || !result.data) throw new AppError("Memory not found", 404, "MEMORY_NOT_FOUND");
    const memory = result.data as MemoryRecord;
    if (input.content !== undefined || input.category !== undefined) {
        const embedding = await embeddingProvider.generateEmbedding(memory.content);
        await saveMemoryEmbedding(token, userId, memory.id, 1, embedding);
    }
    return memory;
};

export const deleteMemory = async (token: string, userId: string, memoryId: string) => {
    const result = await getSupabaseClientForAccessToken(token).from("memories").delete().eq("id", memoryId).eq("user_id", userId);
    if (result.error) dbError(result.error.message);
};

export const extractMemoryCandidate = (content: string): Pick<CreateMemoryInput, "category" | "content"> | null => {
    const value = content.trim();
    if (!value || value.length > 2000 || SECRET_PATTERN.test(value)) return null;
    const signals: Array<{ category: MemoryCategory; pattern: RegExp }> = [
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
