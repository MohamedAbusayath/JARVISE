import { AiChatRequest, AiChatResponse, AiProvider } from "../ai/ai-provider.types";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

type GeminiResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{ text?: string }>;
        };
    }>;
    error?: {
        message?: string;
    };
    responseId?: string;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
};

const GEMINI_API_BASE_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

const toGeminiContents = (request: AiChatRequest) => {
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

export class GeminiProvider implements AiProvider {
    async generateResponse(request: AiChatRequest): Promise<AiChatResponse> {
        if (!env.gemini.apiKey) {
            throw new AppError(
                "Gemini provider is not configured",
                503,
                "AI_PROVIDER_NOT_CONFIGURED"
            );
        }

        const inputCharacters = request.messages.reduce(
            (total, message) => total + message.content.length,
            0
        );

        if (
            inputCharacters === 0 ||
            inputCharacters > env.gemini.maxInputCharacters
        ) {
            throw new AppError(
                "Chat request exceeds the allowed input size",
                413,
                "AI_INPUT_TOO_LARGE"
            );
        }

        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            env.gemini.timeoutMs
        );

        try {
            const response = await fetch(
                `${GEMINI_API_BASE_URL}/${encodeURIComponent(
                    env.gemini.model
                )}:generateContent?key=${encodeURIComponent(env.gemini.apiKey)}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        ...toGeminiContents(request),
                        generationConfig: {
                            maxOutputTokens: env.gemini.maxOutputTokens
                        }
                    }),
                    signal: controller.signal
                }
            );

            const payload = (await response.json()) as GeminiResponse;

            if (!response.ok) {
                throw new AppError(
                    "Gemini request failed",
                    response.status >= 500 ? 502 : 400,
                    "AI_PROVIDER_REQUEST_FAILED"
                );
            }

            const content = payload.candidates?.[0]?.content?.parts
                ?.map((part) => part.text || "")
                .join("")
                .trim();

            if (!content) {
                throw new AppError(
                    "Gemini returned an empty response",
                    502,
                    "AI_PROVIDER_EMPTY_RESPONSE"
                );
            }

            return {
                content,
                provider: "gemini",
                model: env.gemini.model,
                providerResponseId: payload.responseId,
                usage: {
                    inputTokens: payload.usageMetadata?.promptTokenCount,
                    outputTokens: payload.usageMetadata?.candidatesTokenCount,
                    totalTokens: payload.usageMetadata?.totalTokenCount
                }
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }

            if (error instanceof Error && error.name === "AbortError") {
                throw new AppError(
                    "Gemini request timed out",
                    504,
                    "AI_PROVIDER_TIMEOUT"
                );
            }

            throw new AppError(
                "Unable to reach the Gemini provider",
                502,
                "AI_PROVIDER_UNAVAILABLE"
            );
        } finally {
            clearTimeout(timeout);
        }
    }
}
