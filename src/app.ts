import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { env } from "./config/env";
import { httpLogger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.middleware";
import { routes } from "./routes";

z.config(z.locales.pt());

export const app = express();

app.set("trust proxy", env.TRUST_PROXY);
app.use(httpLogger);
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);
