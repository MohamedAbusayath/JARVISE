"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drive_controller_1 = require("../controllers/drive.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const asyncHandler_1 = require("../utils/asyncHandler");
const drive_controller_2 = require("../controllers/drive.controller");
const router = (0, express_1.Router)();
router.get("/callback", (0, asyncHandler_1.asyncHandler)(drive_controller_1.callback));
router.use(auth_middleware_1.requireAuth);
router.get("/connect", (0, asyncHandler_1.asyncHandler)(drive_controller_1.connect));
router.get("/files", (0, asyncHandler_1.asyncHandler)(drive_controller_1.files));
router.get("/files/:fileId", (0, asyncHandler_1.asyncHandler)(drive_controller_1.metadata));
router.get("/files/:fileId/content", (0, asyncHandler_1.asyncHandler)(drive_controller_1.content));
router.post("/sync", (0, asyncHandler_1.asyncHandler)(drive_controller_2.sync));
exports.default = router;
//# sourceMappingURL=drive.routes.js.map