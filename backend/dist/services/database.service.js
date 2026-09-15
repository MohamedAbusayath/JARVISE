"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDatabaseHealth = void 0;
const database_1 = require("../config/database");
const HEALTH_PROBE_TABLE = "__jarvis_health_check";
const TABLE_NOT_FOUND_CODE = "PGRST205";
const toSafeErrorMessage = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    return "Unknown database health check error";
};
const checkDatabaseHealth = async () => {
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();
    if (!(0, database_1.isDatabaseConfigured)()) {
        return {
            provider: "supabase",
            configured: false,
            status: "MISCONFIGURED",
            probe: "schema_cache",
            checkedAt,
            responseTimeMs: Date.now() - startedAt,
            error: "Supabase URL and anon key must be configured"
        };
    }
    try {
        const supabase = (0, database_1.getSupabaseClient)();
        const { error } = await supabase
            .from(HEALTH_PROBE_TABLE)
            .select("id")
            .limit(1);
        if (error) {
            const probeError = error;
            if (probeError.code === TABLE_NOT_FOUND_CODE) {
                return {
                    provider: "supabase",
                    configured: true,
                    status: "ONLINE",
                    probe: "schema_cache",
                    checkedAt,
                    responseTimeMs: Date.now() - startedAt
                };
            }
            return {
                provider: "supabase",
                configured: true,
                status: "OFFLINE",
                probe: "schema_cache",
                checkedAt,
                responseTimeMs: Date.now() - startedAt,
                error: probeError.message || "Supabase health probe failed"
            };
        }
        return {
            provider: "supabase",
            configured: true,
            status: "ONLINE",
            probe: "schema_cache",
            checkedAt,
            responseTimeMs: Date.now() - startedAt
        };
    }
    catch (error) {
        return {
            provider: "supabase",
            configured: true,
            status: "OFFLINE",
            probe: "schema_cache",
            checkedAt,
            responseTimeMs: Date.now() - startedAt,
            error: toSafeErrorMessage(error)
        };
    }
};
exports.checkDatabaseHealth = checkDatabaseHealth;
//# sourceMappingURL=database.service.js.map