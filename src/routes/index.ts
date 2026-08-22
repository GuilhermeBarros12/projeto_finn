import { Router } from "express";
import { authRoutes } from "./auth.routes";
import { healthRoutes } from "./health.routes";
import { usersRoutes } from "./users.routes";

export const routes = Router();

routes.use(healthRoutes);
routes.use("/users", usersRoutes);
routes.use("/auth", authRoutes);
