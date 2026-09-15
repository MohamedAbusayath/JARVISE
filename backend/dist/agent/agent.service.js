"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgent = void 0;
const AppError_1 = require("../utils/AppError");
const tool_audit_1 = require("./tool.audit");
const tool_registry_1 = require("./tool.registry");
require("./tools");
const toolSignals = [
    {
        name: "get_current_time",
        patterns: [/\bwhat time is it\b/i, /\bcurrent time\b/i, /\btime now\b/i]
    },
    {
        name: "search_memory",
        patterns: [/\bremember\b/i, /\bmy preference\b/i, /\bmy goal\b/i, /\bwhat do you know about me\b/i]
    },
    {
        name: "search_drive",
        patterns: [/\bdrive\b/i, /\bdocument\b/i, /\bfile\b/i, /\bfrom my files\b/i]
    }
];
const planTools = (message) => toolSignals
    .filter((signal) => signal.patterns.some((pattern) => pattern.test(message)))
    .map((signal) => signal.name);
const inputFor = (toolName, message) => toolName === "get_current_time" ? {} : { query: message };
const safeToolSummary = (results) => results.map((item) => ({
    role: "system",
    content: `Tool ${item.name} result:\n${JSON.stringify(item.result)}`
}));
const runAgent = async (userId, accessToken, message, baseMessages, authorization) => {
    const calls = planTools(message);
    const results = [];
    for (const name of calls) {
        const input = inputFor(name, message);
        await (0, tool_audit_1.auditToolEvent)(userId, name, "success", "tool.requested", {
            authorization: "backend",
            confirmed: authorization.confirmedToolNames.has(name)
        });
        try {
            const result = await (0, tool_registry_1.executeTool)({ name, input }, { userId, accessToken, authorization });
            results.push(result);
            await (0, tool_audit_1.auditToolEvent)(userId, name, "success");
        }
        catch (error) {
            const denied = error instanceof AppError_1.AppError &&
                error.code === "TOOL_CONFIRMATION_REQUIRED";
            await (0, tool_audit_1.auditToolEvent)(userId, name, denied ? "denied" : "failure", denied ? "tool.denied" : "tool.requested", denied ? { reason: "explicit_confirmation_required" } : {});
            if (error instanceof AppError_1.AppError) {
                throw error;
            }
            throw new AppError_1.AppError("Agent tool execution failed", 502, "AGENT_TOOL_FAILED");
        }
    }
    return {
        messages: [...safeToolSummary(results), ...baseMessages]
    };
};
exports.runAgent = runAgent;
//# sourceMappingURL=agent.service.js.map