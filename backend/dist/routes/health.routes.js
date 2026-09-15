"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_controller_1 = require("../controllers/health.controller");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
router.get("/", health_controller_1.healthCheck);
router.get("/database", (0, asyncHandler_1.asyncHandler)(health_controller_1.databaseHealthCheck));
exports.default = router;
//# sourceMappingURL=health.routes.js.map