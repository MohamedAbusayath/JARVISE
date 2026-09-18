import * as taskService from "../services/task.service";
import { parseCreateTask, parseTaskFilters, parseUpdateTask, isUuid } from "../security/taskValidators";
import { registerTool } from "./tool.registry";
import { Task } from "../types/task.types";

const taskIdSchema = {
    safeParse: (input: unknown) => {
        const value = (input as { taskId?: unknown } | null)?.taskId;
        return typeof value === "string" && isUuid(value)
            ? { success: true as const, data: { taskId: value } }
            : { success: false as const };
    }
};

const taskShape = (value: unknown): value is Task =>
    Boolean(value) && typeof value === "object" && typeof (value as Task).id === "string";

registerTool({
    name: "tasks.list",
    description: "List the authenticated user's active tasks.",
    permission: "READ",
    inputSchema: { safeParse: (input: unknown) => ({ success: true as const, data: parseTaskFilters((input || {}) as Record<string, unknown>) }) },
    timeoutMs: 10000,
    resultValidator: Array.isArray,
    execute: async (input, context) => taskService.listTasks(context.accessToken, context.userId, input!)
});

registerTool({
    name: "tasks.get",
    description: "Get one active task belonging to the authenticated user.",
    permission: "READ",
    inputSchema: taskIdSchema,
    timeoutMs: 10000,
    resultValidator: taskShape,
    execute: async (input, context) => taskService.getTask(context.accessToken, context.userId, input!.taskId)
});

registerTool({
    name: "tasks.create",
    description: "Create a task for the authenticated user.",
    permission: "WRITE",
    inputSchema: { safeParse: parseCreateTask },
    timeoutMs: 10000,
    resultValidator: taskShape,
    execute: async (input, context) => taskService.createTask(context.accessToken, context.userId, input!)
});

registerTool({
    name: "tasks.update",
    description: "Update an existing task owned by the authenticated user.",
    permission: "WRITE",
    inputSchema: {
        safeParse: (input: unknown) => {
            const value = input as { taskId?: unknown; patch?: unknown } | null;
            const parsed = parseUpdateTask(value?.patch);
            return typeof value?.taskId === "string" && isUuid(value.taskId) && parsed.success
                ? { success: true as const, data: { taskId: value.taskId, patch: parsed.data } }
                : { success: false as const };
        }
    },
    timeoutMs: 10000,
    resultValidator: taskShape,
    execute: async (input, context) => taskService.updateTask(context.accessToken, context.userId, input!.taskId, input!.patch)
});

const stateTool = (name: "tasks.complete" | "tasks.reopen", description: string, execute: (token: string, userId: string, taskId: string) => Promise<Task>) => registerTool({
    name,
    description,
    permission: "WRITE" as const,
    inputSchema: taskIdSchema,
    timeoutMs: 10000,
    resultValidator: taskShape,
    execute: async (input, context) => execute(context.accessToken, context.userId, input!.taskId)
});

stateTool("tasks.complete", "Complete an active task owned by the authenticated user.", taskService.completeTask);
stateTool("tasks.reopen", "Reopen a completed task owned by the authenticated user.", taskService.reopenTask);

registerTool({
    name: "tasks.delete",
    description: "Delete an active task owned by the authenticated user.",
    permission: "DESTRUCTIVE",
    inputSchema: taskIdSchema,
    timeoutMs: 10000,
    resultValidator: (result: unknown) => Boolean(result && (result as { deleted?: boolean }).deleted === true),
    execute: async (input, context) => taskService.deleteTask(context.accessToken, context.userId, input!.taskId)
});
