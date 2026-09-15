"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateChatMessage = void 0;
const env_1 = require("../config/env");
const validateChatMessage = (req) => {
    const body = req.body;
    const message = body?.message;
    if (typeof message !== "string" ||
        !message.trim() ||
        message.length > env_1.env.gemini.maxInputCharacters) {
        return {
            valid: false,
            message: typeof message === "string" &&
                message.length > env_1.env.gemini.maxInputCharacters
                ? "Message exceeds the maximum allowed length"
                : "Message is required"
        };
    }
    if (body?.conversationId !== undefined &&
        (typeof body.conversationId !== "string" ||
            !body.conversationId.trim())) {
        return {
            valid: false,
            message: "conversationId must be a valid identifier"
        };
    }
    if (body?.confirmedTools !== undefined &&
        (!Array.isArray(body.confirmedTools) ||
            body.confirmedTools.length > 20 ||
            body.confirmedTools.some((toolName) => typeof toolName !== "string" ||
                !/^[a-z][a-z0-9_]{0,79}$/.test(toolName)))) {
        return {
            valid: false,
            message: "confirmedTools must contain valid tool names"
        };
    }
    return {
        valid: true
    };
};
exports.validateChatMessage = validateChatMessage;
//# sourceMappingURL=requestValidators.js.map