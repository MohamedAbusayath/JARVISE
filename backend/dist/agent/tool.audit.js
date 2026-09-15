"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditToolEvent = void 0;
const database_1 = require("../config/database");
const AppError_1 = require("../utils/AppError");
const auditToolEvent = async (userId, toolName, outcome, eventType = outcome === "success"
    ? "tool.completed"
    : outcome === "denied"
        ? "tool.denied"
        : "tool.requested", details = {}) => {
    const { error } = await (0, database_1.getSupabaseServiceClient)()
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
        throw new AppError_1.AppError("Unable to record tool audit event", 503, "TOOL_AUDIT_FAILED");
    }
};
exports.auditToolEvent = auditToolEvent;
//# sourceMappingURL=tool.audit.js.map