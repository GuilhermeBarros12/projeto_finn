import { Router } from "express";
import { HealthController } from "../controllers/health.controller";

export const healthRoutes = Router();
const healthController = new HealthController();

healthRoutes.get("/health", healthController.check);
