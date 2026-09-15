import { Request, Response } from "express";
import { processMessage } from "../services/jarvis.service";
import { sendSuccess } from "../utils/apiResponse";
import { getAuthenticatedUser } from "../middleware/auth.middleware";

export const chat = async (
    req: Request,
    res: Response
): Promise<void> => {
    const { message, conversationId, confirmedTools } = req.body;
    const { user, accessToken } = getAuthenticatedUser(res);

    const result = await processMessage(
        user.id,
        accessToken,
        message,
        conversationId,
        Array.isArray(confirmedTools)
            ? new Set<string>(confirmedTools)
            : new Set<string>()
    );

    sendSuccess(res, result);
};
