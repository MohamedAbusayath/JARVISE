export const MEMORY_CATEGORIES = [
    "preference",
    "goal",
    "project",
    "learning",
    "personal_context",
    "important_fact",
    "instruction"
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
export type MemorySource = "user" | "conversation" | "document" | "tool" | "import";

export type MemoryRecord = {
    id: string;
    user_id: string;
    memory_type: MemoryCategory;
    importance: number;
    source: MemorySource;
    content: string;
    metadata: Record<string, unknown>;
    source_conversation_id?: string | null;
    source_message_id?: string | null;
    expires_at?: string | null;
    created_at: string;
    updated_at: string;
};

export type CreateMemoryInput = {
    category: MemoryCategory;
    content: string;
    importance?: number;
    expiresAt?: string | null;
    source?: MemorySource;
    sourceConversationId?: string;
    sourceMessageId?: string;
};
