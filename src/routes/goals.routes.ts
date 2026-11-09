import { Router } from "express";
import { GoalController } from "../controllers/goal.controller";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.middleware";

export const goalsRoutes = Router();
const goalController = new GoalController();

goalsRoutes.use(ensureAuthenticated);
goalsRoutes.get("/", goalController.list);
goalsRoutes.post("/", goalController.create);
goalsRoutes.put("/:id", goalController.update);
goalsRoutes.delete("/:id", goalController.delete);
