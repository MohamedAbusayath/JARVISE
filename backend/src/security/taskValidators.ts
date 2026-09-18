import { CreateTaskInput, TaskFilters, TaskPriority, TaskStatus, UpdateTaskInput } from "../types/task.types";

const priorities = new Set<TaskPriority>(["LOW", "MEDIUM", "HIGH"]);
const statuses = new Set<TaskStatus>(["pending", "completed"]);
const isObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeDate = (value: unknown): string | undefined => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return undefined;
    return new Date(value).toISOString();
};

export const parseCreateTask = (input: unknown): { success: true; data: CreateTaskInput } | { success: false } => {
    if (!isObject(input) || typeof input.title !== "string") return { success: false };
    const allowed = new Set(["title", "description", "priority", "due_at"]);
    if (Object.keys(input).some((key) => !allowed.has(key))) return { success: false };
    const title = input.title.trim();
    const description = input.description === undefined ? undefined :
        typeof input.description === "string" ? input.description.trim() : null;
    const dueAt = normalizeDate(input.due_at);
    if (!title || title.length > 300 || description === null || (description && description.length > 10000) ||
        (input.priority !== undefined && (typeof input.priority !== "string" || !priorities.has(input.priority as TaskPriority))) ||
        (input.due_at !== undefined && dueAt === undefined)) return { success: false };
    return { success: true, data: { title, ...(description ? { description } : {}), priority: (input.priority as TaskPriority | undefined) || "MEDIUM", ...(dueAt ? { due_at: dueAt } : {}) } };
};

export const parseUpdateTask = (input: unknown): { success: true; data: UpdateTaskInput } | { success: false } => {
    if (!isObject(input) || Object.keys(input).length === 0) return { success: false };
    const allowed = new Set(["title", "description", "priority", "due_at"]);
    if (Object.keys(input).some((key) => !allowed.has(key))) return { success: false };
    const parsed = parseCreateTask({ title: input.title ?? "placeholder", ...input });
    if (!parsed.success) return parsed;
    const data: UpdateTaskInput = {};
    if (input.title !== undefined) data.title = parsed.data.title;
    if (input.description !== undefined) data.description = parsed.data.description;
    if (input.priority !== undefined) data.priority = parsed.data.priority;
    if (input.due_at !== undefined) data.due_at = parsed.data.due_at;
    return { success: true, data };
};

export const parseTaskFilters = (input: Record<string, unknown>): TaskFilters => ({
    ...(typeof input.status === "string" && statuses.has(input.status as TaskStatus) ? { status: input.status as TaskStatus } : {}),
    ...(typeof input.priority === "string" && priorities.has(input.priority as TaskPriority) ? { priority: input.priority as TaskPriority } : {}),
    limit: Math.min(Math.max(Number(input.limit) || 50, 1), 100)
});

export const isUuid = (value: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
