import { Request, Response } from "express";
import { getSupabaseClientForAccessToken } from "../config/database";
import { getAuthenticatedUser } from "../middleware/auth.middleware";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { createMemory as createStructuredMemory, deleteMemory as deleteStructuredMemory, listMemories as listStructuredMemories, searchMemories, updateMemory as updateStructuredMemory } from "../services/memory.service";

const getClient = (res: Response) => {
    const { accessToken } = getAuthenticatedUser(res);
    return getSupabaseClientForAccessToken(accessToken);
};

const getUserId = (res: Response): string => getAuthenticatedUser(res).user.id;

const throwDatabaseError = (error: { message: string }): never => {
    throw new AppError(error.message, 400, "DATABASE_REQUEST_FAILED");
};

export const listConversations = async (
    _req: Request,
    res: Response
): Promise<void> => {
    const { data, error } = await getClient(res)
        .from("conversations")
        .select("*")
        .eq("user_id", getUserId(res))
        .order("updated_at", { ascending: false });

    if (error) throwDatabaseError(error);
    sendSuccess(res, { conversations: data || [] });
};

export const createConversation = async (
    req: Request,
    res: Response
): Promise<void> => {
    const { title, status, default_provider, default_model, metadata } =
        req.body || {};
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

    if (error) throwDatabaseError(error);
    sendSuccess(res, { conversation: data }, 201);
};

export const listMessages = async (
    req: Request,
    res: Response
): Promise<void> => {
    const { data, error } = await getClient(res)
        .from("messages")
        .select("*")
        .eq("user_id", getUserId(res))
        .eq("conversation_id", req.params.conversationId)
        .order("sequence_no", { ascending: true });

    if (error) throwDatabaseError(error);
    sendSuccess(res, { messages: data || [] });
};

export const createMessage = async (
    req: Request,
    res: Response
): Promise<void> => {
    const { conversation_id, ...message } = req.body || {};
    if (
        typeof conversation_id !== "string" ||
        !conversation_id ||
        typeof message.sequence_no !== "number" ||
        !message.role
    ) {
        throw new AppError(
            "conversation_id, sequence_no, and role are required",
            400,
            "MESSAGE_INPUT_INVALID"
        );
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

    if (error) throwDatabaseError(error);
    sendSuccess(res, { message: data }, 201);
};

export const listMemories = async (
    req: Request,
    res: Response
): Promise<void> => {
    const memories = await listStructuredMemories(getAuthenticatedUser(res).accessToken, getUserId(res), typeof req.query.category === "string" ? req.query.category : undefined);
    sendSuccess(res, { memories });
};

export const createMemory = async (
    req: Request,
    res: Response
): Promise<void> => {
    const memory = await createStructuredMemory(getAuthenticatedUser(res).accessToken, getUserId(res), req.body);
    sendSuccess(res, { memory }, 201);
};

export const searchMemory = async (req: Request, res: Response): Promise<void> => {
    const memories = await searchMemories(getAuthenticatedUser(res).accessToken, getUserId(res), String(req.query.q || ""), typeof req.query.category === "string" ? req.query.category : undefined);
    sendSuccess(res, { memories });
};

export const updateMemory = async (req: Request, res: Response): Promise<void> => {
    const memoryId = req.params.memoryId;
    if (typeof memoryId !== "string") {
        throw new AppError("Memory ID is required", 400, "MEMORY_ID_INVALID");
    }
    const memory = await updateStructuredMemory(getAuthenticatedUser(res).accessToken, getUserId(res), memoryId, req.body);
    sendSuccess(res, { memory });
};

export const deleteMemory = async (req: Request, res: Response): Promise<void> => {
    const memoryId = req.params.memoryId;
    if (typeof memoryId !== "string") {
        throw new AppError("Memory ID is required", 400, "MEMORY_ID_INVALID");
    }
    await deleteStructuredMemory(getAuthenticatedUser(res).accessToken, getUserId(res), memoryId);
    sendSuccess(res, { deleted: true });
};

export const getPreferences = async (
    _req: Request,
    res: Response
): Promise<void> => {
    const { data, error } = await getClient(res)
        .from("user_preferences")
        .select("*")
        .eq("user_id", getUserId(res))
        .maybeSingle();

    if (error) throwDatabaseError(error);
    sendSuccess(res, { preferences: data });
};

export const upsertPreferences = async (
    req: Request,
    res: Response
): Promise<void> => {
    const { data, error } = await getClient(res)
        .from("user_preferences")
        .upsert(
            {
                ...req.body,
                user_id: getUserId(res)
            },
            { onConflict: "user_id" }
        )
        .select()
        .single();

    if (error) throwDatabaseError(error);
    sendSuccess(res, { preferences: data });
};
