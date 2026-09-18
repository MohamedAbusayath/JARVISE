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
    const resourceId = typeof details.resourceId === "string" ? details.resourceId : undefined;
    const { resourceId: _ignoredResourceId, ...safeDetails } = details;
    const { error } = await getSupabaseServiceClient()
        .schema("private")
        .from("audit_events")
        .insert({
            user_id: userId,
            actor_kind: "user",
            event_type: eventType,
            outcome,
            resource_type: typeof details.resource_type === "string" ? details.resource_type : "tool",
            resource_id: resourceId,
            details: {
                tool: toolName,
                ...safeDetails
            }
        });

    if (error) {
        throw new AppError("Unable to record tool audit event", 503, "TOOL_AUDIT_FAILED");
    }
};
