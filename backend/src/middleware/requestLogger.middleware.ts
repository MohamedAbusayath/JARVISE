import { RequestHandler } from "express";

export const requestLogger: RequestHandler = (req, res, next) => {
    const startedAt = Date.now();

    res.on("finish", () => {
        const durationMs = Date.now() - startedAt;

        console.log(`${req.method} ${req.path} ${res.statusCode} ${durationMs}ms`);
    });

    next();
};
