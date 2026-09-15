import { GeminiEmbeddingProvider } from "./embedding.service";
import { searchMemoryEmbeddings } from "./memory.repository";
import { searchDriveChunks } from "./memory.repository";
import { SemanticMemory, SemanticSearchOptions } from "./types";

const embeddingProvider = new GeminiEmbeddingProvider();

export const retrieveSemanticMemories = async (
    accessToken: string,
    userId: string,
    query: string,
    options?: SemanticSearchOptions
): Promise<SemanticMemory[]> => {
    const embedding = await embeddingProvider.generateEmbedding(query);
    return searchMemoryEmbeddings(
        accessToken,
        userId,
        embedding.vector,
        options
    );
};

export const retrieveDriveKnowledge = async (
    accessToken: string,
    userId: string,
    query: string,
    threshold = 0.72,
    limit = 5
) => {
    const embedding = await embeddingProvider.generateEmbedding(query);
    return searchDriveChunks(
        accessToken,
        userId,
        embedding.vector,
        threshold,
        limit
    );
};
