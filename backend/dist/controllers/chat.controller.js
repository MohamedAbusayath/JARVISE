"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = void 0;
const jarvis_service_1 = require("../services/jarvis.service");
const apiResponse_1 = require("../utils/apiResponse");
const auth_middleware_1 = require("../middleware/auth.middleware");
const chat = async (req, res) => {
    const { message, conversationId, confirmedTools } = req.body;
    const { user, accessToken } = (0, auth_middleware_1.getAuthenticatedUser)(res);
    const result = await (0, jarvis_service_1.processMessage)(user.id, accessToken, message, conversationId, Array.isArray(confirmedTools)
        ? new Set(confirmedTools)
        : new Set());
    (0, apiResponse_1.sendSuccess)(res, result);
};
exports.chat = chat;
//# sourceMappingURL=chat.controller.js.map