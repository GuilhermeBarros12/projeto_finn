import express from "express";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.middleware";
import { routes } from "./routes";

export const app = express();

app.use(express.json());
app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);
