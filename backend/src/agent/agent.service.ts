import { AiChatMessage, AiChatRequest } from "../ai/ai-provider.types";
import { AppError } from "../utils/AppError";
import { auditToolEvent } from "./tool.audit";
import { executeTool, ToolResult } from "./tool.registry";
import { ToolAuthorizationContext } from "./tool.types";
import "./tools";

const toolSignals: Array<{ name: string; patterns: RegExp[] }> = [
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

const planTools = (message: string): string[] =>
    toolSignals
        .filter((signal) => signal.patterns.some((pattern) => pattern.test(message)))
        .map((signal) => signal.name);

const inputFor = (toolName: string, message: string): Record<string, unknown> =>
    toolName === "get_current_time" ? {} : { query: message };

const safeToolSummary = (results: ToolResult[]): AiChatMessage[] =>
    results.map((item) => ({
        role: "system",
        content: `Tool ${item.name} result:\n${JSON.stringify(item.result)}`
    }));

export const runAgent = async (
    userId: string,
    accessToken: string,
    message: string,
    baseMessages: AiChatMessage[],
    authorization: ToolAuthorizationContext
): Promise<AiChatRequest> => {
    const calls = planTools(message);
    const results: ToolResult[] = [];

    for (const name of calls) {
        const input = inputFor(name, message);
        await auditToolEvent(userId, name, "success", "tool.requested", {
            authorization: "backend",
            confirmed: authorization.confirmedToolNames.has(name)
        });
        try {
            const result = await executeTool(
                { name, input },
                { userId, accessToken, authorization }
            );
            results.push(result);
            await auditToolEvent(userId, name, "success");
        } catch (error) {
            const denied = error instanceof AppError &&
                error.code === "TOOL_CONFIRMATION_REQUIRED";
            await auditToolEvent(
                userId,
                name,
                denied ? "denied" : "failure",
                denied ? "tool.denied" : "tool.requested",
                denied ? { reason: "explicit_confirmation_required" } : {}
            );
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError("Agent tool execution failed", 502, "AGENT_TOOL_FAILED");
        }
    }

    return {
        messages: [...safeToolSummary(results), ...baseMessages]
    };
};
