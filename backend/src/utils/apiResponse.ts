import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse } from "../types/api.types";

export const sendSuccess = <TPayload extends Record<string, unknown>>(
    res: Response,
    payload: TPayload,
    statusCode = 200
): void => {
    const response: ApiSuccessResponse<TPayload> = {
        success: true,
        ...payload
    };

    res.status(statusCode).json(response);
};

export const sendError = (
    res: Response,
    error: string,
    statusCode = 500,
    details?: Record<string, unknown>
): void => {
    const response: ApiErrorResponse<Record<string, unknown>> = {
        ...details,
        success: false,
        error
    };

    res.status(statusCode).json(response);
};
