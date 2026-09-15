import {
    getSupabaseClient,
    isDatabaseConfigured
} from "../config/database";

type DatabaseHealthState = "ONLINE" | "OFFLINE" | "MISCONFIGURED";
type SupabaseProbeError = {
    code?: string;
    message?: string;
};

export type DatabaseHealthResult = {
    provider: "supabase";
    configured: boolean;
    status: DatabaseHealthState;
    probe: "schema_cache";
    checkedAt: string;
    responseTimeMs: number;
    error?: string;
};

const HEALTH_PROBE_TABLE = "__jarvis_health_check";
const TABLE_NOT_FOUND_CODE = "PGRST205";

const toSafeErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return "Unknown database health check error";
};

export const checkDatabaseHealth = async (): Promise<DatabaseHealthResult> => {
    const startedAt = Date.now();
    const checkedAt = new Date().toISOString();

    if (!isDatabaseConfigured()) {
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
        const supabase = getSupabaseClient();
        const { error } = await supabase
            .from(HEALTH_PROBE_TABLE)
            .select("id")
            .limit(1);

        if (error) {
            const probeError = error as SupabaseProbeError;

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
    } catch (error) {
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
