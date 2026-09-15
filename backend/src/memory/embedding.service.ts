import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { EmbeddingResult } from "./types";

export interface EmbeddingProvider {
    generateEmbedding(text: string): Promise<EmbeddingResult>;
}

type EmbeddingResponse = {
    embedding?: {
        values?: number[];
    };
};

export class GeminiEmbeddingProvider implements EmbeddingProvider {
    async generateEmbedding(text: string): Promise<EmbeddingResult> {
        if (!env.gemini.apiKey) {
            throw new AppError(
                "Embedding provider is not configured",
                503,
                "EMBEDDING_PROVIDER_NOT_CONFIGURED"
            );
        }

        const value = text.trim();
        if (!value || value.length > env.gemini.maxInputCharacters) {
            throw new AppError(
                "Embedding input is invalid",
                413,
                "EMBEDDING_INPUT_TOO_LARGE"
            );
        }

        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            env.gemini.timeoutMs
        );

        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
                    env.gemini.embeddingModel
                )}:embedContent?key=${encodeURIComponent(env.gemini.apiKey)}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        content: {
                            parts: [{ text: value }]
                        }
                    }),
                    signal: controller.signal
                }
            );

            const payload = (await response.json()) as EmbeddingResponse;
            const vector = payload.embedding?.values;

            if (!response.ok || !vector?.length) {
                throw new AppError(
                    "Embedding provider request failed",
                    response.status >= 500 ? 502 : 400,
                    "EMBEDDING_PROVIDER_REQUEST_FAILED"
                );
            }

            return {
                provider: "gemini",
                model: env.gemini.embeddingModel,
                dimensions: vector.length,
                vector
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            if (error instanceof Error && error.name === "AbortError") {
                throw new AppError(
                    "Embedding provider request timed out",
                    504,
                    "EMBEDDING_PROVIDER_TIMEOUT"
                );
            }
            throw new AppError(
                "Unable to reach the embedding provider",
                502,
                "EMBEDDING_PROVIDER_UNAVAILABLE"
            );
        } finally {
            clearTimeout(timeout);
        }
    }
}
