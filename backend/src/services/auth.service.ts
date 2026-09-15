import { AuthResponse, User } from "@supabase/supabase-js";
import {
    getSupabaseClient,
    getSupabaseClientForAccessToken
} from "../config/database";
import { AppError } from "../utils/AppError";

type Credentials = {
    email: string;
    password: string;
};

const assertAuthResponse = (response: AuthResponse) => {
    if (response.error || !response.data.user || !response.data.session) {
        throw new AppError(
            response.error?.message || "Authentication request failed",
            401,
            "AUTHENTICATION_FAILED"
        );
    }

    return response.data;
};

export const registerUser = async ({ email, password }: Credentials) => {
    const response = await getSupabaseClient().auth.signUp({
        email,
        password
    });

    if (response.error) {
        throw new AppError(
            response.error.message,
            response.error.status || 400,
            "REGISTRATION_FAILED"
        );
    }

    return {
        user: response.data.user as User,
        session: response.data.session
    };
};

export const loginUser = async ({ email, password }: Credentials) => {
    const response = await getSupabaseClient().auth.signInWithPassword({
        email,
        password
    });

    return assertAuthResponse(response);
};

export const logoutUser = async (accessToken: string): Promise<void> => {
    const { error } = await getSupabaseClientForAccessToken(
        accessToken
    ).auth.signOut();

    if (error) {
        throw new AppError(
            error.message,
            401,
            "LOGOUT_FAILED"
        );
    }
};