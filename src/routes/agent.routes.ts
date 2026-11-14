import { Router } from "express";
import { AgentController } from "../controllers/agent.controller";
import { ensureAuthenticated } from "../middlewares/ensure-authenticated.middleware";
import { agentLimiter } from "../middlewares/rate-limit.middleware";

export const agentRoutes = Router();
const agentController = new AgentController();

agentRoutes.use(ensureAuthenticated);
agentRoutes.post("/chat", agentLimiter, agentController.chat);
