import { Request, Response } from "express";
import { checkDatabaseHealth } from "../services/database.service";
import { sendError, sendSuccess } from "../utils/apiResponse";

export const healthCheck = (req: Request, res: Response): void => {
    sendSuccess(res, {
        service: "JARVIS",
        version: "0.1.0",
        status: "ONLINE"
    });
};

export const databaseHealthCheck = async (
    req: Request,
    res: Response
): Promise<void> => {
    const database = await checkDatabaseHealth();
    const statusCode = database.status === "ONLINE" ? 200 : 503;

    if (database.status !== "ONLINE") {
        sendError(
            res,
            database.error || "Database health check failed",
            statusCode,
            {
                service: "JARVIS",
                database
            }
        );
        return;
    }

    sendSuccess(res, {
        service: "JARVIS",
        database
    });
};
