import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { categoriesRoutes } from "./categories.routes";
import { dashboardRoutes } from "./dashboard.routes";
import { exportsRoutes } from "./exports.routes";
import { healthRoutes } from "./health.routes";
import { goalsRoutes } from "./goals.routes";
import { transactionsRoutes } from "./transactions.routes";
import { usersRoutes } from "./users.routes";

export const routes = Router();

routes.use(healthRoutes);
routes.use("/users", usersRoutes);
routes.use("/auth", authRoutes);
routes.use("/categories", categoriesRoutes);
routes.use("/transactions", transactionsRoutes);
routes.use("/dashboard", dashboardRoutes);
routes.use("/goals", goalsRoutes);
routes.use("/exports", exportsRoutes);
