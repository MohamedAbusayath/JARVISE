import { getSupabaseClientForAccessToken } from "../config/database";
import { AppError } from "../utils/AppError";
import { auditToolEvent } from "../agent/tool.audit";
import { CreateTaskInput, Task, TaskFilters, UpdateTaskInput } from "../types/task.types";
import * as repository from "../repositories/task.repository";

const databaseError = (): never => { throw new AppError("Task request could not be completed", 503, "TASK_DATABASE_ERROR"); };
const requireTask = (data: unknown): Task => {
    if (!data) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
    return data as Task;
};
const withAudit = async <T>(userId: string, action: string, taskId: string | undefined, operation: () => Promise<T>): Promise<T> => {
    try {
        const result = await operation();
        await auditToolEvent(userId, `tasks.${action}`, "success", "tool.completed", { resource_type: "task", resourceId: taskId, action });
        return result;
    } catch (error) {
        if (error instanceof AppError && error.code === "TASK_AUDIT_FAILED") throw error;
        await auditToolEvent(userId, `tasks.${action}`, "failure", "tool.requested", { resource_type: "task", resourceId: taskId, action }).catch(() => undefined);
        throw error;
    }
};

export const createTask = (token: string, userId: string, input: CreateTaskInput) =>
    withAudit(userId, "create", undefined, async () => {
        const { data, error } = await repository.insertTask(getSupabaseClientForAccessToken(token), userId, input);
        if (error) databaseError();
        return requireTask(data);
    });

export const listTasks = async (token: string, userId: string, filters: TaskFilters) => {
    const { data, error } = await repository.findTasks(getSupabaseClientForAccessToken(token), userId, filters);
    if (error) databaseError();
    return data || [];
};

export const getTask = async (token: string, userId: string, taskId: string) => {
    const { data, error } = await repository.findTask(getSupabaseClientForAccessToken(token), userId, taskId);
    if (error) databaseError();
    return requireTask(data);
};

export const updateTask = (token: string, userId: string, taskId: string, input: UpdateTaskInput) =>
    withAudit(userId, "update", taskId, async () => {
        const { data, error } = await repository.updateTask(getSupabaseClientForAccessToken(token), userId, taskId, input);
        if (error) databaseError();
        return requireTask(data);
    });

export const completeTask = (token: string, userId: string, taskId: string) =>
    withAudit(userId, "complete", taskId, async () => {
        const current = await getTask(token, userId, taskId);
        if (current.status === "completed") throw new AppError("Task is already completed", 409, "TASK_ALREADY_COMPLETED");
        const { data, error } = await repository.setTaskCompletion(getSupabaseClientForAccessToken(token), userId, taskId, true);
        if (error) databaseError();
        return requireTask(data);
    });

export const reopenTask = (token: string, userId: string, taskId: string) =>
    withAudit(userId, "reopen", taskId, async () => {
        const current = await getTask(token, userId, taskId);
        if (current.status === "pending") throw new AppError("Task is already pending", 409, "TASK_ALREADY_PENDING");
        const { data, error } = await repository.setTaskCompletion(getSupabaseClientForAccessToken(token), userId, taskId, false);
        if (error) databaseError();
        return requireTask(data);
    });

export const deleteTask = (token: string, userId: string, taskId: string) =>
    withAudit(userId, "delete", taskId, async () => {
        const { data, error } = await repository.softDeleteTask(getSupabaseClientForAccessToken(token), userId, taskId);
        if (error) databaseError();
        if (!data) throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
        return { deleted: true, taskId };
    });
