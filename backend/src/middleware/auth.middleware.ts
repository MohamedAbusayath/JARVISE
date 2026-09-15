import { NextFunction, Request, Response } from "express";
import { getSupabaseClient } from "../config/database";
import { AppError } from "../utils/AppError";

const getBearerToken = (req: Request): string => {
    const header = req.header("authorization");

    if (!header || !header.startsWith("Bearer ")) {
        throw new AppError(
            "Authentication token is required",
            401,
            "AUTH_TOKEN_MISSING"
        );
    }

    const token = header.slice("Bearer ".length).trim();

    if (!token) {
        throw new AppError(
            "Authentication token is required",
            401,
            "AUTH_TOKEN_MISSING"
        );
    }

    return token;
};

export const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const accessToken = getBearerToken(req);
        const {
            data: { user },
            error
        } = await getSupabaseClient().auth.getUser(accessToken);

        if (error || !user) {
            throw new AppError(
                "Authentication token is invalid or expired",
                401,
                "AUTH_TOKEN_INVALID"
            );
        }

        res.locals.auth = {
            user,
            accessToken
        };

        next();
    } catch (error) {
        next(error);
    }
};

export const getAuthenticatedUser = (res: Response) => {
    const auth = res.locals.auth as
        | { user: { id: string }; accessToken: string }
        | undefined;

    if (!auth) {
        throw new AppError(
            "Authenticated user context is missing",
            401,
            "AUTH_CONTEXT_MISSING"
        );
    }

    return auth;
};
