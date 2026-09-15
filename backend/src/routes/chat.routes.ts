import { Router } from "express";
import { chat } from "../controllers/chat.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { validateChatMessage } from "../security/requestValidators";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.post(
    "/",
    requireAuth,
    validateRequest(validateChatMessage),
    asyncHandler(chat)
);

export default router;
