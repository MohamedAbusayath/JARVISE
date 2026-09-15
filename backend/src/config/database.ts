import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { AppError } from "../utils/AppError";

let supabaseClient: SupabaseClient | null = null;

const normalizeSupabaseUrl = (url: string): string => {
    return url.trim().replace(/\/+$/, "");
};

export const isDatabaseConfigured = (): boolean => {
    return Boolean(env.supabase.url && env.supabase.anonKey);
};

export const validateDatabaseConfig = (): void => {
    if (!env.supabase.url || !env.supabase.anonKey) {
        throw new AppError(
            "Supabase database configuration is missing",
            503,
            "DATABASE_CONFIG_MISSING"
        );
    }

    try {
        new URL(env.supabase.url);
    } catch {
        throw new AppError(
            "Supabase URL is invalid",
            503,
            "DATABASE_CONFIG_INVALID"
        );
    }
};

export const getSupabaseClient = (): SupabaseClient => {
    validateDatabaseConfig();

    if (!supabaseClient) {
        supabaseClient = createClient(
            normalizeSupabaseUrl(env.supabase.url),
            env.supabase.anonKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        );
    }

    return supabaseClient;
};

export const getSupabaseClientForAccessToken = (
    accessToken: string
): SupabaseClient => {
    validateDatabaseConfig();

    return createClient(
        normalizeSupabaseUrl(env.supabase.url),
        env.supabase.anonKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            },
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        }
    );
};

export const getSupabaseServiceClient = (): SupabaseClient => {
    if (!env.supabase.url || !env.supabase.serviceRoleKey) {
        throw new AppError(
            "Supabase service configuration is missing",
            503,
            "DATABASE_SERVICE_CONFIG_MISSING"
        );
    }

    return createClient(
        normalizeSupabaseUrl(env.supabase.url),
        env.supabase.serviceRoleKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    );
};
