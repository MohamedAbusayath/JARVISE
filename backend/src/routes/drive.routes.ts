import { Router } from "express";
import { callback, connect, content, files, metadata } from "../controllers/drive.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { sync } from "../controllers/drive.controller";

const router = Router();
router.get("/callback", asyncHandler(callback));
router.use(requireAuth);
router.get("/connect", asyncHandler(connect));
router.get("/files", asyncHandler(files));
router.get("/files/:fileId", asyncHandler(metadata));
router.get("/files/:fileId/content", asyncHandler(content));
router.post("/sync", asyncHandler(sync));
export default router;
