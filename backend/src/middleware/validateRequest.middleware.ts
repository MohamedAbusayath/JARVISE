import { RequestHandler } from "express";
import { RequestValidator } from "../types/validation.types";
import { AppError } from "../utils/AppError";

export const validateRequest = (validator: RequestValidator): RequestHandler => {
    return (req, _res, next): void => {
        const result = validator(req);

        if (!result.valid) {
            next(new AppError(result.message, 400, "VALIDATION_ERROR", result.details));
            return;
        }

        next();
    };
};
