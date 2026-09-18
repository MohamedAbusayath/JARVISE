import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import * as controller from "../controllers/task.controller";

const router = Router();
router.use(requireAuth);
router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:taskId", asyncHandler(controller.get));
router.patch("/:taskId", asyncHandler(controller.update));
router.post("/:taskId/complete", asyncHandler(controller.complete));
router.post("/:taskId/reopen", asyncHandler(controller.reopen));
router.delete("/:taskId", asyncHandler(controller.remove));
export default router;