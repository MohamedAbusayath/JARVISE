export type EmbeddingVector = number[];

export type EmbeddingResult = {
    provider: string;
    model: string;
    dimensions: number;
    vector: EmbeddingVector;
};

export type SemanticMemory = {
    id: string;
    memory_id: string;
    content: string;
    memory_type: string;
    importance: number;
    similarity: number;
    expires_at: string | null;
};

export type SemanticSearchOptions = {
    threshold?: number;
    limit?: number;
};
