import type { AgentResponse } from "../src/lib/agent-model";

const response = (fields: Partial<AgentResponse>): AgentResponse =>
  ({ usage: { input_tokens: 1, output_tokens: 1 }, ...fields }) as AgentResponse;

export const textResponse = (text: string): AgentResponse =>
  response({ stop_reason: "end_turn", content: [{ type: "text", text, citations: null }] });

export const toolResponse = (calls: Array<{ name: string; input: unknown }>): AgentResponse =>
  response({
    stop_reason: "tool_use",
    content: calls.map(({ name, input }, index) => ({
      type: "tool_use",
      id: `chamada-${index}`,
      name,
      input,
    })) as AgentResponse["content"],
  });

export const refusalResponse = (): AgentResponse =>
  response({ stop_reason: "refusal", content: [] });

export const question = { messages: [{ role: "user", content: "Quanto gastei?" }] };
