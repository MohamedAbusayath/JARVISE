import { AppError } from "../utils/AppError";
import {
    ToolCall,
    ToolContext,
    ToolDefinition,
    ToolPermission,
    ToolResult
} from "./tool.types";
export type { ToolResult } from "./tool.types";

const tools = new Map<string, ToolDefinition<unknown, unknown>>();

export const registerTool = <TInput, TResult>(
    definition: ToolDefinition<TInput, TResult>
): void => {
    if (tools.has(definition.name)) {
        throw new Error(`Tool already registered: ${definition.name}`);
    }
    tools.set(definition.name, definition as ToolDefinition<unknown, unknown>);
};

export const getToolDefinitions = () => Array.from(tools.values()).map((tool) => ({
    name: tool.name,
    description: tool.description,
    permission: tool.permission,
    inputSchema: tool.inputSchema
}));

const requiresConfirmation = (permission: ToolPermission): boolean =>
    permission === "DESTRUCTIVE" || permission === "SENSITIVE";

const isToolPermission = (value: unknown): value is ToolPermission =>
    value === "READ" ||
    value === "WRITE" ||
    value === "DESTRUCTIVE" ||
    value === "SENSITIVE";

export const executeTool = async (
    call: ToolCall,
    context: ToolContext
): Promise<ToolResult> => {
    const tool = tools.get(call.name);
    if (!tool) {
        throw new AppError("Requested tool is not available", 400, "TOOL_NOT_FOUND");
    }
    if (
        !context.userId ||
        !context.accessToken ||
        !context.authorization ||
        !(context.authorization.confirmedToolNames instanceof Set)
    ) {
        throw new AppError("Authenticated tool context is required", 401, "TOOL_AUTH_REQUIRED");
    }
    if (!isToolPermission(tool.permission)) {
        throw new AppError(
            "Tool permission metadata is missing",
            500,
            "TOOL_PERMISSION_MISSING"
        );
    }
    if (
        requiresConfirmation(tool.permission) &&
        !context.authorization.confirmedToolNames.has(tool.name)
    ) {
        throw new AppError(
            "Explicit confirmation is required for this tool",
            403,
            "TOOL_CONFIRMATION_REQUIRED",
            { tool: tool.name, permission: tool.permission }
        );
    }

    const parsed = tool.inputSchema.safeParse(call.input);
    if (!parsed.success) {
        throw new AppError("Tool input is invalid", 400, "TOOL_INPUT_INVALID");
    }

    let timeout: NodeJS.Timeout | undefined;
    try {
        const operation = tool.execute(parsed.data, context);
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
                reject(new AppError("Tool execution timed out", 504, "TOOL_TIMEOUT"));
            }, tool.timeoutMs);
        });
        const result = await Promise.race([operation, timeoutPromise]);
        if (tool.resultValidator && !tool.resultValidator(result)) {
            throw new AppError("Tool returned an invalid result", 502, "TOOL_RESULT_INVALID");
        }
        return {
            name: tool.name,
            result
        };
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError("Tool execution failed", 502, "TOOL_EXECUTION_FAILED");
    } finally {
        if (timeout) clearTimeout(timeout);
    }
};
