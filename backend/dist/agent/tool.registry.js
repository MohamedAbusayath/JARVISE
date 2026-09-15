"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeTool = exports.getToolDefinitions = exports.registerTool = void 0;
const AppError_1 = require("../utils/AppError");
const tools = new Map();
const registerTool = (definition) => {
    if (tools.has(definition.name)) {
        throw new Error(`Tool already registered: ${definition.name}`);
    }
    tools.set(definition.name, definition);
};
exports.registerTool = registerTool;
const getToolDefinitions = () => Array.from(tools.values()).map((tool) => ({
    name: tool.name,
    description: tool.description,
    permission: tool.permission,
    inputSchema: tool.inputSchema
}));
exports.getToolDefinitions = getToolDefinitions;
const requiresConfirmation = (permission) => permission === "DESTRUCTIVE" || permission === "SENSITIVE";
const isToolPermission = (value) => value === "READ" ||
    value === "WRITE" ||
    value === "DESTRUCTIVE" ||
    value === "SENSITIVE";
const executeTool = async (call, context) => {
    const tool = tools.get(call.name);
    if (!tool) {
        throw new AppError_1.AppError("Requested tool is not available", 400, "TOOL_NOT_FOUND");
    }
    if (!context.userId ||
        !context.accessToken ||
        !context.authorization ||
        !(context.authorization.confirmedToolNames instanceof Set)) {
        throw new AppError_1.AppError("Authenticated tool context is required", 401, "TOOL_AUTH_REQUIRED");
    }
    if (!isToolPermission(tool.permission)) {
        throw new AppError_1.AppError("Tool permission metadata is missing", 500, "TOOL_PERMISSION_MISSING");
    }
    if (requiresConfirmation(tool.permission) &&
        !context.authorization.confirmedToolNames.has(tool.name)) {
        throw new AppError_1.AppError("Explicit confirmation is required for this tool", 403, "TOOL_CONFIRMATION_REQUIRED", { tool: tool.name, permission: tool.permission });
    }
    const parsed = tool.inputSchema.safeParse(call.input);
    if (!parsed.success) {
        throw new AppError_1.AppError("Tool input is invalid", 400, "TOOL_INPUT_INVALID");
    }
    let timeout;
    try {
        const operation = tool.execute(parsed.data, context);
        const timeoutPromise = new Promise((_, reject) => {
            timeout = setTimeout(() => {
                reject(new AppError_1.AppError("Tool execution timed out", 504, "TOOL_TIMEOUT"));
            }, tool.timeoutMs);
        });
        const result = await Promise.race([operation, timeoutPromise]);
        if (tool.resultValidator && !tool.resultValidator(result)) {
            throw new AppError_1.AppError("Tool returned an invalid result", 502, "TOOL_RESULT_INVALID");
        }
        return {
            name: tool.name,
            result
        };
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            throw error;
        }
        throw new AppError_1.AppError("Tool execution failed", 502, "TOOL_EXECUTION_FAILED");
    }
    finally {
        if (timeout)
            clearTimeout(timeout);
    }
};
exports.executeTool = executeTool;
//# sourceMappingURL=tool.registry.js.map