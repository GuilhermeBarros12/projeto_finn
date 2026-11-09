import { Router } from "express";
import { ExportController } from "../controllers/export.controller";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.middleware";

export const exportsRoutes = Router();
const exportController = new ExportController();

exportsRoutes.use(ensureAuthenticated);
exportsRoutes.get("/transactions", exportController.transactions);
