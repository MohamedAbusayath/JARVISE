"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertPreferences = exports.getPreferences = exports.deleteMemory = exports.updateMemory = exports.searchMemory = exports.createMemory = exports.listMemories = exports.createMessage = exports.listMessages = exports.createConversation = exports.listConversations = void 0;
const database_1 = require("../config/database");
const auth_middleware_1 = require("../middleware/auth.middleware");
const apiResponse_1 = require("../utils/apiResponse");
const AppError_1 = require("../utils/AppError");
const memory_service_1 = require("../services/memory.service");
const getClient = (res) => {
    const { accessToken } = (0, auth_middleware_1.getAuthenticatedUser)(res);
    return (0, database_1.getSupabaseClientForAccessToken)(accessToken);
};
const getUserId = (res) => (0, auth_middleware_1.getAuthenticatedUser)(res).user.id;
const throwDatabaseError = (error) => {
    throw new AppError_1.AppError(error.message, 400, "DATABASE_REQUEST_FAILED");
};
const listConversations = async (_req, res) => {
    const { data, error } = await getClient(res)
        .from("conversations")
        .select("*")
        .eq("user_id", getUserId(res))
        .order("updated_at", { ascending: false });
    if (error)
        throwDatabaseError(error);
    (0, apiResponse_1.sendSuccess)(res, { conversations: data || [] });
};
exports.listConversations = listConversations;
const createConversation = async (req, res) => {
    const { title, status, default_provider, default_model, metadata } = req.body || {};
    const { data, error } = await getClient(res)
        .from("conversations")
        .insert({
        user_id: getUserId(res),
        title,
        status,
        default_provider,
        default_model,
        metadata
    })
        .select()
        .single();
    if (error)
        throwDatabaseError(error);
    (0, apiResponse_1.sendSuccess)(res, { conversation: data }, 201);
};
exports.createConversation = createConversation;
const listMessages = async (req, res) => {
    const { data, error } = await getClient(res)
        .from("messages")
        .select("*")
        .eq("user_id", getUserId(res))
        .eq("conversation_id", req.params.conversationId)
        .order("sequence_no", { ascending: true });
    if (error)
        throwDatabaseError(error);
    (0, apiResponse_1.sendSuccess)(res, { messages: data || [] });
};
exports.listMessages = listMessages;
const createMessage = async (req, res) => {
    const { conversation_id, ...message } = req.body || {};
    if (typeof conversation_id !== "string" ||
        !conversation_id ||
        typeof message.sequence_no !== "number" ||
        !message.role) {
        throw new AppError_1.AppError("conversation_id, sequence_no, and role are required", 400, "MESSAGE_INPUT_INVALID");
    }
    const { data, error } = await getClient(res)
        .from("messages")
        .insert({
        ...message,
        conversation_id,
        user_id: getUserId(res)
    })
        .select()
        .single();
    if (error)
        throwDatabaseError(error);
    (0, apiResponse_1.sendSuccess)(res, { message: data }, 201);
};
exports.createMessage = createMessage;
const listMemories = async (req, res) => {
    const memories = await (0, memory_service_1.listMemories)((0, auth_middleware_1.getAuthenticatedUser)(res).accessToken, getUserId(res), typeof req.query.category === "string" ? req.query.category : undefined);
    (0, apiResponse_1.sendSuccess)(res, { memories });
};
exports.listMemories = listMemories;
const createMemory = async (req, res) => {
    const memory = await (0, memory_service_1.createMemory)((0, auth_middleware_1.getAuthenticatedUser)(res).accessToken, getUserId(res), req.body);
    (0, apiResponse_1.sendSuccess)(res, { memory }, 201);
};
exports.createMemory = createMemory;
const searchMemory = async (req, res) => {
    const memories = await (0, memory_service_1.searchMemories)((0, auth_middleware_1.getAuthenticatedUser)(res).accessToken, getUserId(res), String(req.query.q || ""), typeof req.query.category === "string" ? req.query.category : undefined);
    (0, apiResponse_1.sendSuccess)(res, { memories });
};
exports.searchMemory = searchMemory;
const updateMemory = async (req, res) => {
    const memoryId = req.params.memoryId;
    if (typeof memoryId !== "string") {
        throw new AppError_1.AppError("Memory ID is required", 400, "MEMORY_ID_INVALID");
    }
    const memory = await (0, memory_service_1.updateMemory)((0, auth_middleware_1.getAuthenticatedUser)(res).accessToken, getUserId(res), memoryId, req.body);
    (0, apiResponse_1.sendSuccess)(res, { memory });
};
exports.updateMemory = updateMemory;
const deleteMemory = async (req, res) => {
    const memoryId = req.params.memoryId;
    if (typeof memoryId !== "string") {
        throw new AppError_1.AppError("Memory ID is required", 400, "MEMORY_ID_INVALID");
    }
    await (0, memory_service_1.deleteMemory)((0, auth_middleware_1.getAuthenticatedUser)(res).accessToken, getUserId(res), memoryId);
    (0, apiResponse_1.sendSuccess)(res, { deleted: true });
};
exports.deleteMemory = deleteMemory;
const getPreferences = async (_req, res) => {
    const { data, error } = await getClient(res)
        .from("user_preferences")
        .select("*")
        .eq("user_id", getUserId(res))
        .maybeSingle();
    if (error)
        throwDatabaseError(error);
    (0, apiResponse_1.sendSuccess)(res, { preferences: data });
};
exports.getPreferences = getPreferences;
const upsertPreferences = async (req, res) => {
    const { data, error } = await getClient(res)
        .from("user_preferences")
        .upsert({
        ...req.body,
        user_id: getUserId(res)
    }, { onConflict: "user_id" })
        .select()
        .single();
    if (error)
        throwDatabaseError(error);
    (0, apiResponse_1.sendSuccess)(res, { preferences: data });
};
exports.upsertPreferences = upsertPreferences;
//# sourceMappingURL=resource.controller.js.map