import { RequestHandler } from "express";
import { AppError } from "../utils/AppError";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));
};
