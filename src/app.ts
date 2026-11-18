import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { env } from "./config/env";
import { auth } from "./lib/auth";
import { httpLogger } from "./lib/logger";
import { bodyLimit } from "./middlewares/body-limit.middleware";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.middleware";
import {
  loginLimiter,
  passwordResetIpLimiter,
  passwordResetLimiter,
  signupLimiter,
} from "./middlewares/rate-limit.middleware";
import { routes } from "./routes";

z.config(z.locales.pt());

const JSON_LIMIT_BYTES = 100 * 1024;

export const app = express();

app.set("trust proxy", env.TRUST_PROXY);
app.use(httpLogger);
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }));

// O Better Auth lê o corpo sozinho: precisa vir antes do express.json.
app.use("/api/auth", bodyLimit(JSON_LIMIT_BYTES));
app.post("/api/auth/sign-in/email", loginLimiter);
app.post("/api/auth/sign-up/email", signupLimiter);
// O limite por e-mail precisa do corpo, então estas duas rotas o leem antes; o Better Auth
// aceita o corpo já lido.
const readJson = express.json({ limit: JSON_LIMIT_BYTES });
app.post(
  "/api/auth/request-password-reset",
  readJson,
  passwordResetIpLimiter,
  passwordResetLimiter,
);
app.post("/api/auth/reset-password", readJson, passwordResetIpLimiter);
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: JSON_LIMIT_BYTES }));
app.use("/api", routes);
app.use(notFoundHandler);
app.use(errorHandler);
