import { SupabaseClient } from "@supabase/supabase-js";
import { Task, TaskFilters, CreateTaskInput, UpdateTaskInput } from "../types/task.types";

export const insertTask = async (client: SupabaseClient, userId: string, input: CreateTaskInput) =>
    client.from("tasks").insert({ ...input, user_id: userId }).select("*").single();

export const findTasks = async (client: SupabaseClient, userId: string, filters: TaskFilters) => {
    let query = client.from("tasks").select("*").eq("user_id", userId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(filters.limit || 50);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.priority) query = query.eq("priority", filters.priority);
    return query;
};

export const findTask = (client: SupabaseClient, userId: string, taskId: string) =>
    client.from("tasks").select("*").eq("user_id", userId).eq("id", taskId).is("deleted_at", null).maybeSingle();

export const updateTask = (client: SupabaseClient, userId: string, taskId: string, input: UpdateTaskInput) =>
    client.from("tasks").update(input).eq("user_id", userId).eq("id", taskId).is("deleted_at", null).select("*").maybeSingle();

export const setTaskCompletion = (client: SupabaseClient, userId: string, taskId: string, completed: boolean) =>
    client.from("tasks").update({ status: completed ? "completed" : "pending", completed_at: completed ? new Date().toISOString() : null }).eq("user_id", userId).eq("id", taskId).is("deleted_at", null).select("*").maybeSingle();

export const softDeleteTask = (client: SupabaseClient, userId: string, taskId: string) =>
    client.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("user_id", userId).eq("id", taskId).is("deleted_at", null).select("id").maybeSingle();

export const taskShape = (value: unknown): value is Task =>
    Boolean(value) && typeof value === "object" && typeof (value as Task).id === "string" && typeof (value as Task).title === "string";
