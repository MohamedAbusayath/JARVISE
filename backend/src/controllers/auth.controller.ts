import { Request, Response } from "express";
import {
    loginUser,
    logoutUser,
    registerUser
} from "../services/auth.service";
import { getAuthenticatedUser } from "../middleware/auth.middleware";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";

const getCredentials = (req: Request) => {
    const { email, password } = req.body as {
        email?: unknown;
        password?: unknown;
    };

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        throw new AppError(
            "Email and password are required",
            400,
            "AUTH_CREDENTIALS_INVALID"
        );
    }

    return {
        email: email.trim().toLowerCase(),
        password
    };
};

export const register = async (
    req: Request,
    res: Response
): Promise<void> => {
    const result = await registerUser(getCredentials(req));

    sendSuccess(
        res,
        {
            user: result.user,
            session: result.session
        },
        201
    );
};

export const login = async (req: Request, res: Response): Promise<void> => {
    const result = await loginUser(getCredentials(req));

    sendSuccess(res, {
        user: result.user,
        session: result.session
    });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    const { accessToken } = getAuthenticatedUser(res);
    await logoutUser(accessToken);
    sendSuccess(res, { loggedOut: true });
};