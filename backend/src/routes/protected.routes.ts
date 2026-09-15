import { Router } from "express";
import {
    createConversation,
    createMemory,
    createMessage,
    getPreferences,
    listConversations,
    listMemories,
    searchMemory,
    updateMemory,
    deleteMemory,
    listMessages,
    upsertPreferences
} from "../controllers/resource.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(requireAuth);
router.get("/conversations", asyncHandler(listConversations));
router.post("/conversations", asyncHandler(createConversation));
router.get(
    "/conversations/:conversationId/messages",
    asyncHandler(listMessages)
);
router.post("/messages", asyncHandler(createMessage));
router.get("/memories", asyncHandler(listMemories));
router.post("/memories", asyncHandler(createMemory));
router.get("/memories/search", asyncHandler(searchMemory));
router.patch("/memories/:memoryId", asyncHandler(updateMemory));
router.delete("/memories/:memoryId", asyncHandler(deleteMemory));
router.get("/preferences", asyncHandler(getPreferences));
router.put("/preferences", asyncHandler(upsertPreferences));

export default router;
