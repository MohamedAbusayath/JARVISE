import { ErrorRequestHandler } from "express";
import { AppError } from "../utils/AppError";
import { sendError } from "../utils/apiResponse";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    if (res.headersSent) {
        return;
    }

    if (error instanceof AppError) {
        sendError(res, error.message, error.statusCode, {
            code: error.code || "REQUEST_FAILED"
        });
        return;
    }

    if (error instanceof SyntaxError && "body" in error) {
        sendError(res, "Invalid JSON payload", 400);
        return;
    }

    console.error("Unhandled request error:", {
        method: req.method,
        path: req.path,
        message: error instanceof Error ? error.message : "Unknown error"
    });

    sendError(res, "Internal Server Error", 500);
};
