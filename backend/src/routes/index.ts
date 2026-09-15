import { Router } from "express";
import healthRoutes from "./health.routes";
import chatRoutes from "./chat.routes";
import authRoutes from "./auth.routes";
import protectedRoutes from "./protected.routes";
import driveRoutes from "./drive.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/chat", chatRoutes);
router.use("/auth", authRoutes);
router.use("/drive", driveRoutes);
router.use("/", protectedRoutes);

export default router;
