import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { loginLimiter, refreshLimiter } from "../middlewares/rate-limit.middleware";

export const authRoutes = Router();
const authController = new AuthController();

authRoutes.post("/login", loginLimiter, authController.login);
authRoutes.post("/refresh", refreshLimiter, authController.refresh);
authRoutes.post("/logout", authController.logout);
