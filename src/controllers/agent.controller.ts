import type { Request, Response } from "express";
import { agentChatSchema } from "../schemas/agent.schema";
import { AgentService } from "../services/agent.service";

export class AgentController {
  constructor(private readonly agentService = new AgentService()) {}

  chat = async (request: Request, response: Response): Promise<void> => {
    const reply = await this.agentService.reply(
      request.userId!,
      agentChatSchema.parse(request.body),
    );
    response.status(200).json({ reply });
  };
}
