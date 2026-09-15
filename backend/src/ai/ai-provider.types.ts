export type AiChatMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

export type AiChatRequest = {
    messages: AiChatMessage[];
};

export type AiChatResponse = {
    content: string;
    provider?: string;
    model?: string;
    providerResponseId?: string;
    usage?: {
        inputTokens?: number;
        outputTokens?: number;
        totalTokens?: number;
    };
};

export interface AiProvider {
    generateResponse(request: AiChatRequest): Promise<AiChatResponse>;
}
