import { Router } from "express";
import { CategoryController } from "../controllers/category.controller";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.middleware";

export const categoriesRoutes = Router();
const categoryController = new CategoryController();

categoriesRoutes.use(ensureAuthenticated);
categoriesRoutes.get("/", categoryController.list);
categoriesRoutes.post("/", categoryController.create);
categoriesRoutes.patch("/:id/deactivate", categoryController.deactivate);
