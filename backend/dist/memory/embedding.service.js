"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiEmbeddingProvider = void 0;
const env_1 = require("../config/env");
const AppError_1 = require("../utils/AppError");
class GeminiEmbeddingProvider {
    async generateEmbedding(text) {
        if (!env_1.env.gemini.apiKey) {
            throw new AppError_1.AppError("Embedding provider is not configured", 503, "EMBEDDING_PROVIDER_NOT_CONFIGURED");
        }
        const value = text.trim();
        if (!value || value.length > env_1.env.gemini.maxInputCharacters) {
            throw new AppError_1.AppError("Embedding input is invalid", 413, "EMBEDDING_INPUT_TOO_LARGE");
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env_1.env.gemini.timeoutMs);
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env_1.env.gemini.embeddingModel)}:embedContent?key=${encodeURIComponent(env_1.env.gemini.apiKey)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: {
                        parts: [{ text: value }]
                    }
                }),
                signal: controller.signal
            });
            const payload = (await response.json());
            const vector = payload.embedding?.values;
            if (!response.ok || !vector?.length) {
                throw new AppError_1.AppError("Embedding provider request failed", response.status >= 500 ? 502 : 400, "EMBEDDING_PROVIDER_REQUEST_FAILED");
            }
            return {
                provider: "gemini",
                model: env_1.env.gemini.embeddingModel,
                dimensions: vector.length,
                vector
            };
        }
        catch (error) {
            if (error instanceof AppError_1.AppError) {
                throw error;
            }
            if (error instanceof Error && error.name === "AbortError") {
                throw new AppError_1.AppError("Embedding provider request timed out", 504, "EMBEDDING_PROVIDER_TIMEOUT");
            }
            throw new AppError_1.AppError("Unable to reach the embedding provider", 502, "EMBEDDING_PROVIDER_UNAVAILABLE");
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.GeminiEmbeddingProvider = GeminiEmbeddingProvider;
//# sourceMappingURL=embedding.service.js.map