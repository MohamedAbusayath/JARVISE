import { Router } from "express";
import {
    databaseHealthCheck,
    healthCheck
} from "../controllers/health.controller";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", healthCheck);
router.get("/database", asyncHandler(databaseHealthCheck));

export default router;
