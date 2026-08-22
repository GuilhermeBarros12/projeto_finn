import { Router } from "express";
import { TransactionController } from "../controllers/transaction.controller";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.middleware";

export const transactionsRoutes = Router();
const transactionController = new TransactionController();

transactionsRoutes.use(ensureAuthenticated);
transactionsRoutes.get("/", transactionController.list);
transactionsRoutes.post("/", transactionController.create);
transactionsRoutes.put("/:id", transactionController.update);
transactionsRoutes.delete("/:id", transactionController.delete);
