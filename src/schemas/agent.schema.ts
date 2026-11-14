import { z } from "zod";

export const MAX_AGENT_MESSAGES = 20;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const agentChatSchema = z.object({
  messages: z
    .array(messageSchema)
    .min(1)
    .max(MAX_AGENT_MESSAGES)
    .refine((messages) => messages[0]?.role === "user", {
      message: "A conversa deve começar com uma mensagem da pessoa.",
    })
    .refine((messages) => messages.at(-1)?.role === "user", {
      message: "A última mensagem deve ser da pessoa.",
    }),
});

export type AgentChatInput = z.infer<typeof agentChatSchema>;
