import { Router } from "express";
import { UserController } from "../controllers/user.controller";

export const usersRoutes = Router();
const userController = new UserController();

usersRoutes.post("/", userController.create);
