import { retrieveDriveKnowledge, retrieveSemanticMemories } from "../memory/memory.service";
import { registerTool } from "./tool.registry";

const emptySchema = {
    safeParse: (input: unknown) =>
        input && typeof input === "object" && Object.keys(input).length === 0
            ? { success: true as const, data: {} }
            : { success: false as const }
};

const querySchema = {
    safeParse: (input: unknown) => {
        const query = (input as { query?: unknown } | null)?.query;
        return typeof query === "string" && query.trim().length > 0 && query.length <= 200
            ? { success: true as const, data: { query: query.trim() } }
            : { success: false as const };
    }
};

registerTool<{}, { iso: string; timezone: string }>({
    name: "get_current_time",
    description: "Get the current server time as an ISO timestamp.",
    permission: "READ",
    inputSchema: emptySchema,
    timeoutMs: 1000,
    resultValidator: (result) =>
        typeof result.iso === "string" && result.timezone === "UTC",
    execute: async () => ({
        iso: new Date().toISOString(),
        timezone: "UTC"
    })
});

registerTool<{ query: string }, Awaited<ReturnType<typeof retrieveSemanticMemories>>>({
    name: "search_memory",
    description: "Search the authenticated user's relevant long-term memories.",
    permission: "READ",
    inputSchema: querySchema,
    timeoutMs: 15000,
    resultValidator: Array.isArray,
    execute: async (input, context) =>
        retrieveSemanticMemories(context.accessToken, context.userId, input.query, {
            threshold: 0.72,
            limit: 5
        })
});

registerTool<{ query: string }, Awaited<ReturnType<typeof retrieveDriveKnowledge>>>({
    name: "search_drive",
    description: "Search the authenticated user's indexed Google Drive document chunks.",
    permission: "READ",
    inputSchema: querySchema,
    timeoutMs: 15000,
    resultValidator: Array.isArray,
    execute: async (input, context) =>
        retrieveDriveKnowledge(context.accessToken, context.userId, input.query, 0.72, 5)
});
