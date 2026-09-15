"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMessage = void 0;
const gemini_service_1 = require("./gemini.service");
const conversation_service_1 = require("./conversation.service");
const env_1 = require("../config/env");
const memory_service_1 = require("./memory.service");
const AppError_1 = require("../utils/AppError");
const memory_service_2 = require("../memory/memory.service");
const memory_service_3 = require("../memory/memory.service");
const agent_service_1 = require("../agent/agent.service");
const aiProvider = new gemini_service_1.GeminiProvider();
const processMessage = async (userId, accessToken, message, conversationId, confirmedToolNames = new Set()) => {
    const context = await (0, conversation_service_1.loadConversationContext)(accessToken, userId, { message, conversationId }, env_1.env.gemini.contextMessageLimit);
    const semanticMemories = await (0, memory_service_2.retrieveSemanticMemories)(accessToken, userId, message, { threshold: env_1.env.memory.semanticThreshold, limit: env_1.env.memory.semanticLimit });
    const memoryContext = semanticMemories.map((memory) => ({
        role: "system",
        content: `Relevant user memory (${memory.memory_type}): ${memory.content}`
    }));
    const driveChunks = await (0, memory_service_3.retrieveDriveKnowledge)(accessToken, userId, message, env_1.env.memory.semanticThreshold, env_1.env.memory.semanticLimit);
    const driveContext = driveChunks.map((chunk) => ({
        role: "system",
        content: `Relevant Drive document (${chunk.filename}): ${chunk.content}`
    }));
    const request = await (0, agent_service_1.runAgent)(userId, accessToken, message, [...memoryContext, ...driveContext, ...context.messages], {
        confirmedToolNames,
        assuranceLevel: "standard"
    });
    const response = await aiProvider.generateResponse(request);
    await (0, conversation_service_1.saveAssistantMessage)(accessToken, userId, context.conversationId, response);
    const candidate = (0, memory_service_1.extractMemoryCandidate)(message);
    if (candidate) {
        try {
            await (0, memory_service_1.createMemory)(accessToken, userId, {
                ...candidate,
                source: "conversation",
                sourceConversationId: context.conversationId,
                sourceMessageId: context.userMessageId
            });
        }
        catch (error) {
            if (error instanceof AppError_1.AppError) {
                console.warn("Automatic memory extraction skipped", error.code);
            }
            else {
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
exports.processMessage = processMessage;
//# sourceMappingURL=jarvis.service.js.map