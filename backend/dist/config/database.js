"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseServiceClient = exports.getSupabaseClientForAccessToken = exports.getSupabaseClient = exports.validateDatabaseConfig = exports.isDatabaseConfigured = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("./env");
const AppError_1 = require("../utils/AppError");
let supabaseClient = null;
const normalizeSupabaseUrl = (url) => {
    return url.trim().replace(/\/+$/, "");
};
const isDatabaseConfigured = () => {
    return Boolean(env_1.env.supabase.url && env_1.env.supabase.anonKey);
};
exports.isDatabaseConfigured = isDatabaseConfigured;
const validateDatabaseConfig = () => {
    if (!env_1.env.supabase.url || !env_1.env.supabase.anonKey) {
        throw new AppError_1.AppError("Supabase database configuration is missing", 503, "DATABASE_CONFIG_MISSING");
    }
    try {
        new URL(env_1.env.supabase.url);
    }
    catch {
        throw new AppError_1.AppError("Supabase URL is invalid", 503, "DATABASE_CONFIG_INVALID");
    }
};
exports.validateDatabaseConfig = validateDatabaseConfig;
const getSupabaseClient = () => {
    (0, exports.validateDatabaseConfig)();
    if (!supabaseClient) {
        supabaseClient = (0, supabase_js_1.createClient)(normalizeSupabaseUrl(env_1.env.supabase.url), env_1.env.supabase.anonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });
    }
    return supabaseClient;
};
exports.getSupabaseClient = getSupabaseClient;
const getSupabaseClientForAccessToken = (accessToken) => {
    (0, exports.validateDatabaseConfig)();
    return (0, supabase_js_1.createClient)(normalizeSupabaseUrl(env_1.env.supabase.url), env_1.env.supabase.anonKey, {
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
    });
};
exports.getSupabaseClientForAccessToken = getSupabaseClientForAccessToken;
const getSupabaseServiceClient = () => {
    if (!env_1.env.supabase.url || !env_1.env.supabase.serviceRoleKey) {
        throw new AppError_1.AppError("Supabase service configuration is missing", 503, "DATABASE_SERVICE_CONFIG_MISSING");
    }
    return (0, supabase_js_1.createClient)(normalizeSupabaseUrl(env_1.env.supabase.url), env_1.env.supabase.serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
};
exports.getSupabaseServiceClient = getSupabaseServiceClient;
//# sourceMappingURL=database.js.map