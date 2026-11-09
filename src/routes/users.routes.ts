import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { signupLimiter } from "../middlewares/rate-limit.middleware";

export const usersRoutes = Router();
const userController = new UserController();

usersRoutes.post("/", signupLimiter, userController.create);
