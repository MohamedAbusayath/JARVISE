import { getSupabaseClientForAccessToken } from "../config/database";
import { AppError } from "../utils/AppError";
import {
    EmbeddingResult,
    SemanticMemory,
    SemanticSearchOptions
} from "./types";

const throwDatabaseError = (message: string): never => {
    throw new AppError(message, 400, "MEMORY_DATABASE_ERROR");
};

export const saveMemoryEmbedding = async (
    accessToken: string,
    userId: string,
    memoryId: string,
    contentRevision: number,
    embedding: EmbeddingResult
): Promise<void> => {
    if (
        embedding.vector.length === 0 ||
        embedding.vector.some((value) => !Number.isFinite(value))
    ) {
        throw new AppError(
            "Embedding vector is invalid",
            400,
            "EMBEDDING_VECTOR_INVALID"
        );
    }
    const client = getSupabaseClientForAccessToken(accessToken);
    const { error } = await client.from("memory_embeddings").upsert(
        {
            user_id: userId,
            memory_id: memoryId,
            content_revision: contentRevision,
            embedding_provider: embedding.provider,
            embedding_model: embedding.model,
            embedding_dimensions: embedding.dimensions,
            embedding: `[${embedding.vector.join(",")}]`
        },
        { onConflict: "memory_id,embedding_provider,embedding_model" }
    );

    if (error) {
        throwDatabaseError(error.message);
    }
};

export const searchMemoryEmbeddings = async (
    accessToken: string,
    userId: string,
    vector: number[],
    options: SemanticSearchOptions = {}
): Promise<SemanticMemory[]> => {
    const threshold = options.threshold ?? 0.72;
    const limit = options.limit ?? 5;

    if (
        vector.length === 0 ||
        vector.some((value) => !Number.isFinite(value)) ||
        threshold < 0 ||
        threshold > 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 20
    ) {
        throw new AppError(
            "Semantic memory search options are invalid",
            400,
            "MEMORY_SEARCH_OPTIONS_INVALID"
        );
    }

    const { data, error } = await getSupabaseClientForAccessToken(accessToken).rpc(
        "match_memories",
        {
            query_embedding: `[${vector.join(",")}]`,
            match_threshold: threshold,
            match_count: limit,
            requesting_user_id: userId
        }
    );

    if (error) {
        throwDatabaseError(error.message);
    }

    return (data || []) as SemanticMemory[];
};

export const searchDriveChunks = async (
    accessToken: string,
    userId: string,
    vector: number[],
    threshold = 0.72,
    limit = 5
) => {
    if (
        vector.length === 0 ||
        vector.some((value) => !Number.isFinite(value)) ||
        threshold < 0 ||
        threshold > 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 20
    ) {
        throw new AppError(
            "Drive semantic search options are invalid",
            400,
            "DRIVE_SEARCH_OPTIONS_INVALID"
        );
    }

    const { data, error } = await getSupabaseClientForAccessToken(accessToken).rpc(
        "match_drive_chunks",
        {
            query_embedding: `[${vector.join(",")}]`,
            match_threshold: threshold,
            match_count: limit,
            requesting_user_id: userId
        }
    );
    if (error) throwDatabaseError(error.message);
    return data || [];
};
