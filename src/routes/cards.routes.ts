import { Router } from "express";
import { CardController } from "../controllers/card.controller";
import { InvoiceController } from "../controllers/invoice.controller";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.middleware";

export const cardsRoutes = Router();
const cardController = new CardController();
const invoiceController = new InvoiceController();

cardsRoutes.use(ensureAuthenticated);
cardsRoutes.get("/", cardController.list);
cardsRoutes.post("/", cardController.create);
// Rotas fixas entram antes das rotas com /:id.
cardsRoutes.get("/overview", invoiceController.overview);
cardsRoutes.get("/:id/invoices/current", invoiceController.current);
cardsRoutes.get("/:id/invoices/:year/:month", invoiceController.byMonth);
cardsRoutes.put("/:id", cardController.update);
cardsRoutes.patch("/:id/default", cardController.setDefault);
cardsRoutes.patch("/:id/deactivate", cardController.deactivate);
