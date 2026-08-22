import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.middleware";

export const dashboardRoutes = Router();
const dashboardController = new DashboardController();

dashboardRoutes.use(ensureAuthenticated);
dashboardRoutes.get("/summary", dashboardController.summary);
dashboardRoutes.get("/by-category", dashboardController.byCategory);
