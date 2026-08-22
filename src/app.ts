import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.middleware";
import { routes } from "./routes";

export const app = express();

app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(express.json());
app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);
