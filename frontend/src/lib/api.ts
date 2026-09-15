import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export type ApiResult<T> = { success: true } & T;
export type Conversation = { id: string; title: string | null; updated_at: string; last_message_at?: string | null };
export type Message = { id: string; role: "user" | "assistant" | "system"; content_text: string; created_at: string };
export type Memory = { id: string; memory_type: string; content: string; importance: number; updated_at: string };

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
            ...(options.headers || {})
        }
    });
    const body = await response.json().catch(() => ({ error: "Unable to read server response" }));
    if (!response.ok || body.success === false) throw new Error(body.error || "Something went wrong");
    return body as T;
};

export const api = {
    chat: (message: string, conversationId?: string, confirmedTools: string[] = []) =>
        request<{ reply: string; conversationId: string }>("/chat", {
            method: "POST", body: JSON.stringify({ message, conversationId, confirmedTools })
        }),
    conversations: () => request<ApiResult<{ conversations: Conversation[] }>>("/conversations"),
    messages: (id: string) => request<ApiResult<{ messages: Message[] }>>(`/conversations/${id}/messages`),
    memories: () => request<ApiResult<{ memories: Memory[] }>>("/memories"),
    deleteMemory: (id: string) => request(`/memories/${id}`, { method: "DELETE" }),
    preferences: () => request<ApiResult<{ preferences: Record<string, unknown> | null }>>("/preferences"),
    savePreferences: (preferences: Record<string, unknown>) =>
        request("/preferences", { method: "PUT", body: JSON.stringify(preferences) }),
    driveFiles: () => request<ApiResult<{ files: Array<{ id: string; name: string; mimeType: string; modifiedTime: string }> }>>("/drive/files"),
    driveConnect: () => request<ApiResult<{ authorizationUrl: string }>>("/drive/connect")
};
