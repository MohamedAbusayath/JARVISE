"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const env_1 = require("../config/env");
const AppError_1 = require("../utils/AppError");
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const toGeminiContents = (request) => {
    const systemMessages = request.messages
        .filter((message) => message.role === "system")
        .map((message) => message.content.trim())
        .filter(Boolean);
    const contents = request.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
    }));
    return {
        systemInstruction: systemMessages.length
            ? { parts: [{ text: systemMessages.join("\n\n") }] }
            : undefined,
        contents
    };
};
class GeminiProvider {
    async generateResponse(request) {
        if (!env_1.env.gemini.apiKey) {
            throw new AppError_1.AppError("Gemini provider is not configured", 503, "AI_PROVIDER_NOT_CONFIGURED");
        }
        const inputCharacters = request.messages.reduce((total, message) => total + message.content.length, 0);
        if (inputCharacters === 0 ||
            inputCharacters > env_1.env.gemini.maxInputCharacters) {
            throw new AppError_1.AppError("Chat request exceeds the allowed input size", 413, "AI_INPUT_TOO_LARGE");
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), env_1.env.gemini.timeoutMs);
        try {
            const response = await fetch(`${GEMINI_API_BASE_URL}/${encodeURIComponent(env_1.env.gemini.model)}:generateContent?key=${encodeURIComponent(env_1.env.gemini.apiKey)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ...toGeminiContents(request),
                    generationConfig: {
                        maxOutputTokens: env_1.env.gemini.maxOutputTokens
                    }
                }),
                signal: controller.signal
            });
            const payload = (await response.json());
            if (!response.ok) {
                throw new AppError_1.AppError("Gemini request failed", response.status >= 500 ? 502 : 400, "AI_PROVIDER_REQUEST_FAILED");
            }
            const content = payload.candidates?.[0]?.content?.parts
                ?.map((part) => part.text || "")
                .join("")
                .trim();
            if (!content) {
                throw new AppError_1.AppError("Gemini returned an empty response", 502, "AI_PROVIDER_EMPTY_RESPONSE");
            }
            return {
                content,
                provider: "gemini",
                model: env_1.env.gemini.model,
                providerResponseId: payload.responseId,
                usage: {
                    inputTokens: payload.usageMetadata?.promptTokenCount,
                    outputTokens: payload.usageMetadata?.candidatesTokenCount,
                    totalTokens: payload.usageMetadata?.totalTokenCount
                }
            };
        }
        catch (error) {
            if (error instanceof AppError_1.AppError) {
                throw error;
            }
            if (error instanceof Error && error.name === "AbortError") {
                throw new AppError_1.AppError("Gemini request timed out", 504, "AI_PROVIDER_TIMEOUT");
            }
            throw new AppError_1.AppError("Unable to reach the Gemini provider", 502, "AI_PROVIDER_UNAVAILABLE");
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.GeminiProvider = GeminiProvider;
//# sourceMappingURL=gemini.service.js.map