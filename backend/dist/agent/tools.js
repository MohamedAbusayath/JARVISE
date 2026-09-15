"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const memory_service_1 = require("../memory/memory.service");
const tool_registry_1 = require("./tool.registry");
const emptySchema = {
    safeParse: (input) => input && typeof input === "object" && Object.keys(input).length === 0
        ? { success: true, data: {} }
        : { success: false }
};
const querySchema = {
    safeParse: (input) => {
        const query = input?.query;
        return typeof query === "string" && query.trim().length > 0 && query.length <= 200
            ? { success: true, data: { query: query.trim() } }
            : { success: false };
    }
};
(0, tool_registry_1.registerTool)({
    name: "get_current_time",
    description: "Get the current server time as an ISO timestamp.",
    permission: "READ",
    inputSchema: emptySchema,
    timeoutMs: 1000,
    resultValidator: (result) => typeof result.iso === "string" && result.timezone === "UTC",
    execute: async () => ({
        iso: new Date().toISOString(),
        timezone: "UTC"
    })
});
(0, tool_registry_1.registerTool)({
    name: "search_memory",
    description: "Search the authenticated user's relevant long-term memories.",
    permission: "READ",
    inputSchema: querySchema,
    timeoutMs: 15000,
    resultValidator: Array.isArray,
    execute: async (input, context) => (0, memory_service_1.retrieveSemanticMemories)(context.accessToken, context.userId, input.query, {
        threshold: 0.72,
        limit: 5
    })
});
(0, tool_registry_1.registerTool)({
    name: "search_drive",
    description: "Search the authenticated user's indexed Google Drive document chunks.",
    permission: "READ",
    inputSchema: querySchema,
    timeoutMs: 15000,
    resultValidator: Array.isArray,
    execute: async (input, context) => (0, memory_service_1.retrieveDriveKnowledge)(context.accessToken, context.userId, input.query, 0.72, 5)
});
//# sourceMappingURL=tools.js.map