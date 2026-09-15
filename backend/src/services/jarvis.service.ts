
import { AiChatRequest } from "../ai/ai-provider.types";
import { GeminiProvider } from "./gemini.service";
import {
    loadConversationContext,
    saveAssistantMessage
} from "./conversation.service";
import { env } from "../config/env";
import { createMemory, extractMemoryCandidate } from "./memory.service";
import { AppError } from "../utils/AppError";
import { retrieveSemanticMemories } from "../memory/memory.service";
import { retrieveDriveKnowledge } from "../memory/memory.service";
import { runAgent } from "../agent/agent.service";
import { ToolAuthorizationContext } from "../agent/tool.types";

const aiProvider = new GeminiProvider();

export const processMessage = async (
    userId: string,
    accessToken: string,
    message: string,
    conversationId?: string,
    confirmedToolNames: ReadonlySet<string> = new Set<string>()
) => {
    const context = await loadConversationContext(
        accessToken,
        userId,
        { message, conversationId },
        env.gemini.contextMessageLimit
    );

    const semanticMemories = await retrieveSemanticMemories(
        accessToken,
        userId,
        message,
        { threshold: env.memory.semanticThreshold, limit: env.memory.semanticLimit }
    );
    const memoryContext = semanticMemories.map((memory) => ({
        role: "system" as const,
        content: `Relevant user memory (${memory.memory_type}): ${memory.content}`
    }));
    const driveChunks = await retrieveDriveKnowledge(
        accessToken,
        userId,
        message,
        env.memory.semanticThreshold,
        env.memory.semanticLimit
    );
    const driveContext = driveChunks.map((chunk: {
        filename: string;
        content: string;
    }) => ({
        role: "system" as const,
        content: `Relevant Drive document (${chunk.filename}): ${chunk.content}`
    }));
    const request = await runAgent(
        userId,
        accessToken,
        message,
        [...memoryContext, ...driveContext, ...context.messages],
        {
            confirmedToolNames,
            assuranceLevel: "standard"
        } satisfies ToolAuthorizationContext
    );
    const response = await aiProvider.generateResponse(request);
    await saveAssistantMessage(
        accessToken,
        userId,
        context.conversationId,
        response
    );

    const candidate = extractMemoryCandidate(message);
    if (candidate) {
        try {
            await createMemory(accessToken, userId, {
                ...candidate,
                source: "conversation",
                sourceConversationId: context.conversationId,
                sourceMessageId: context.userMessageId
            });
        } catch (error) {
            if (error instanceof AppError) {
                console.warn("Automatic memory extraction skipped", error.code);
            } else {
                console.warn("Automatic memory extraction skipped");
            }
        }
    }

    return {
        reply: response.content,
        conversationId: context.conversationId,
        provider: response.provider,
        model: response.model,
        usage: response.usage
    };
};