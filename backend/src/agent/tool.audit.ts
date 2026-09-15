import { getSupabaseServiceClient } from "../config/database";
import { AppError } from "../utils/AppError";

export const auditToolEvent = async (
    userId: string,
    toolName: string,
    outcome: "success" | "failure" | "denied",
    eventType: "tool.requested" | "tool.completed" | "tool.denied" = outcome === "success"
        ? "tool.completed"
        : outcome === "denied"
          ? "tool.denied"
          : "tool.requested",
    details: Record<string, unknown> = {}
): Promise<void> => {
    const { error } = await getSupabaseServiceClient()
        .schema("private")
        .from("audit_events")
        .insert({
            user_id: userId,
            actor_kind: "user",
            event_type: eventType,
            outcome,
            resource_type: "tool",
            details: {
                tool: toolName,
                ...details
            }
        });

    if (error) {
        throw new AppError("Unable to record tool audit event", 503, "TOOL_AUDIT_FAILED");
    }
};
