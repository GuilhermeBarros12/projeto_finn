import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { AppError } from "./app-error";

export type AgentResponse = Anthropic.Beta.Messages.BetaMessage;
export type AgentMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
export type AgentTool = Anthropic.Beta.Messages.BetaTool;
export type AgentSystemBlock = Anthropic.Beta.Messages.BetaTextBlockParam;

export interface AgentModelRequest {
  system: AgentSystemBlock[];
  messages: AgentMessageParam[];
  tools: AgentTool[];
}

let client: Anthropic | undefined;

const getClient = (): Anthropic => {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError("O assistente ainda não foi configurado neste servidor.", 503);
  }

  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 90_000, maxRetries: 1 });
  return client;
};

export const translateModelError = (error: unknown): unknown => {
  if (error instanceof Anthropic.RateLimitError) {
    return new AppError("O assistente recebeu muitas perguntas. Tente em instantes.", 429, {
      cause: error,
    });
  }

  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new AppError("O assistente está indisponível por um problema de configuração.", 503, {
      cause: error,
    });
  }

  if (error instanceof Anthropic.APIError) {
    return new AppError("O assistente não conseguiu responder agora. Tente novamente.", 502, {
      cause: error,
    });
  }

  return error;
};

/** Único ponto do projeto que fala com a API da Anthropic; os testes trocam só esta função. */
export const callModel = async ({
  system,
  messages,
  tools,
}: AgentModelRequest): Promise<AgentResponse> => {
  const anthropic = getClient();
  // A Haiku não tem modelo de reserva no servidor; as demais refazem a resposta recusada.
  const fallback = env.ANTHROPIC_MODEL.includes("haiku")
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

  try {
    return await anthropic.beta.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 16_000,
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      system,
      tools,
      messages,
      ...fallback,
    });
  } catch (error) {
    throw translateModelError(error);
  }
};
