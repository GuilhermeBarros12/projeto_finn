import { Router } from "express";
import { agentRoutes } from "./agent.routes";
import { cardsRoutes } from "./cards.routes";
import { categoriesRoutes } from "./categories.routes";
import { configRoutes } from "./config.routes";
import { dashboardRoutes } from "./dashboard.routes";
import { exportsRoutes } from "./exports.routes";
import { healthRoutes } from "./health.routes";
import { goalsRoutes } from "./goals.routes";
import { recurrencesRoutes } from "./recurrences.routes";
import { transactionsRoutes } from "./transactions.routes";

export const routes = Router();

routes.use(healthRoutes);
routes.use(configRoutes);
routes.use("/cards", cardsRoutes);
routes.use("/categories", categoriesRoutes);
routes.use("/transactions", transactionsRoutes);
routes.use("/recurrences", recurrencesRoutes);
routes.use("/dashboard", dashboardRoutes);
routes.use("/goals", goalsRoutes);
routes.use("/exports", exportsRoutes);
routes.use("/agent", agentRoutes);
