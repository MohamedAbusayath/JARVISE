export type TaskStatus = "pending" | "completed";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type Task = {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    due_at: string | null;
    completed_at: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
};

export type CreateTaskInput = {
    title: string;
    description?: string;
    priority?: TaskPriority;
    due_at?: string;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type TaskFilters = {
    status?: TaskStatus;
    priority?: TaskPriority;
    limit?: number;
};
