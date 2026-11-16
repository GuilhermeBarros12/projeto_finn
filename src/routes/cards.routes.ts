import { Router } from "express";
import { CardController } from "../controllers/card.controller";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.middleware";

export const cardsRoutes = Router();
const cardController = new CardController();

cardsRoutes.use(ensureAuthenticated);
cardsRoutes.get("/", cardController.list);
cardsRoutes.post("/", cardController.create);
// Rotas fixas (como /overview, na etapa de faturas) entram antes das rotas com /:id.
cardsRoutes.put("/:id", cardController.update);
cardsRoutes.patch("/:id/default", cardController.setDefault);
cardsRoutes.patch("/:id/deactivate", cardController.deactivate);
