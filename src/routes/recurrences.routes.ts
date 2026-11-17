import { Router } from "express";
import { RecurrenceController } from "../controllers/recurrence.controller";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.middleware";

export const recurrencesRoutes = Router();
const recurrenceController = new RecurrenceController();

recurrencesRoutes.use(ensureAuthenticated);
recurrencesRoutes.get("/ending", recurrenceController.ending);
recurrencesRoutes.post("/:id/renew", recurrenceController.renew);
recurrencesRoutes.patch("/:id/finish", recurrenceController.finish);
