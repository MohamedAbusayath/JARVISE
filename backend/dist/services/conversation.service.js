"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveAssistantMessage = exports.loadConversationContext = void 0;
const database_1 = require("../config/database");
const AppError_1 = require("../utils/AppError");
const throwDatabaseError = (message) => {
    throw new AppError_1.AppError(message, 400, "CONVERSATION_DATABASE_ERROR");
};
const requireId = (value, message) => {
    if (!value) {
        throw new AppError_1.AppError(message, 400, "CONVERSATION_DATABASE_ERROR");
    }
    return value;
};
const nextSequence = async (client, conversationId) => {
    const { data, error } = await client
        .from("messages")
        .select("sequence_no")
        .eq("conversation_id", conversationId)
        .order("sequence_no", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error)
        throwDatabaseError(error.message);
    return Number(data?.sequence_no || 0) + 1;
};
const loadConversationContext = async (accessToken, userId, input, contextMessageLimit) => {
    const client = (0, database_1.getSupabaseClientForAccessToken)(accessToken);
    let conversationId = input.conversationId;
    if (conversationId) {
        const { data, error } = await client
            .from("conversations")
            .select("id")
            .eq("id", conversationId)
            .eq("user_id", userId)
            .maybeSingle();
        if (error)
            throwDatabaseError(error.message);
        if (!data) {
            throw new AppError_1.AppError("Conversation not found", 404, "CONVERSATION_NOT_FOUND");
        }
    }
    else {
        const { data, error } = await client
            .from("conversations")
            .insert({
            user_id: userId,
            status: "active",
            title: input.message.slice(0, 300)
        })
            .select("id")
            .single();
        const createdConversationId = data?.id;
        if (error || !createdConversationId) {
            throwDatabaseError(error?.message || "Unable to create conversation");
        }
        if (!createdConversationId) {
            throwDatabaseError("Unable to create conversation");
        }
        conversationId = createdConversationId;
    }
    const resolvedConversationId = requireId(conversationId, "Conversation ID was not created");
    const sequenceNo = await nextSequence(client, resolvedConversationId);
    const { data: userMessage, error: userMessageError } = await client
        .from("messages")
        .insert({
        user_id: userId,
        conversation_id: resolvedConversationId,
        sequence_no: sequenceNo,
        role: "user",
        status: "completed",
        content_text: input.message
    })
        .select("id")
        .single();
    const userMessageId = userMessage?.id;
    if (userMessageError) {
        throwDatabaseError(userMessageError?.message || "Unable to save user message");
    }
    const savedUserMessageId = requireId(userMessageId, "Unable to save user message");
    const { data: history, error: historyError } = await client
        .from("messages")
        .select("role, content_text")
        .eq("conversation_id", resolvedConversationId)
        .in("role", ["user", "assistant"])
        .eq("status", "completed")
        .order("sequence_no", { ascending: false })
        .limit(contextMessageLimit);
    if (historyError)
        throwDatabaseError(historyError.message);
    const messages = (history || [])
        .reverse()
        .filter((message) => typeof message.content_text === "string" &&
        message.content_text.trim())
        .map((message) => ({
        role: message.role,
        content: message.content_text
    }));
    return {
        conversationId: resolvedConversationId,
        messages,
        userMessageId: savedUserMessageId
    };
};
exports.loadConversationContext = loadConversationContext;
const saveAssistantMessage = async (accessToken, userId, conversationId, response) => {
    const client = (0, database_1.getSupabaseClientForAccessToken)(accessToken);
    const sequenceNo = await nextSequence(client, conversationId);
    const { data, error } = await client
        .from("messages")
        .insert({
        user_id: userId,
        conversation_id: conversationId,
        sequence_no: sequenceNo,
        role: "assistant",
        status: "completed",
        content_text: response.content,
        provider: response.provider,
        model_name: response.model,
        provider_response_id: response.providerResponseId,
        input_tokens: response.usage?.inputTokens,
        output_tokens: response.usage?.outputTokens,
        total_tokens: response.usage?.totalTokens,
        usage_details: response.usage || {}
    })
        .select("id")
        .single();
    const assistantMessageId = data?.id;
    if (error || !assistantMessageId) {
        throwDatabaseError(error?.message || "Unable to save assistant message");
    }
    await client
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("user_id", userId);
    return assistantMessageId;
};
exports.saveAssistantMessage = saveAssistantMessage;
//# sourceMappingURL=conversation.service.js.map