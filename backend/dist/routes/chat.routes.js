"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_controller_1 = require("../controllers/chat.controller");
const validateRequest_middleware_1 = require("../middleware/validateRequest.middleware");
const requestValidators_1 = require("../security/requestValidators");
const asyncHandler_1 = require("../utils/asyncHandler");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post("/", auth_middleware_1.requireAuth, (0, validateRequest_middleware_1.validateRequest)(requestValidators_1.validateChatMessage), (0, asyncHandler_1.asyncHandler)(chat_controller_1.chat));
exports.default = router;
//# sourceMappingURL=chat.routes.js.map