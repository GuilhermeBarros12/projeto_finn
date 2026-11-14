import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import AssistantPage from "./AssistantPage";

vi.mock("../api", () => ({ api: { post: vi.fn() } }));

const post = vi.mocked(api.post);

const type = (text: string) =>
  userEvent.type(screen.getByLabelText("Pergunta para o assistente"), text);
const submit = () => userEvent.click(screen.getByLabelText("Enviar pergunta"));

beforeEach(() => {
  post.mockReset();
});

describe("AssistantPage", () => {
  it("avisa que só lê os dados e para onde eles vão", () => {
    render(<AssistantPage />);

    expect(screen.getByText(/sem alterar nada/)).toHaveTextContent("Anthropic");
  });

  it("envia a pergunta e mostra a resposta", async () => {
    post.mockResolvedValue({ data: { reply: "Você gastou R$ 10,00." } });
    render(<AssistantPage />);

    await type("Quanto gastei?");
    await submit();

    expect(await screen.findByText("Você gastou R$ 10,00.")).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith("/agent/chat", {
      messages: [{ role: "user", content: "Quanto gastei?" }],
    });
    expect(screen.getByLabelText("Pergunta para o assistente")).toHaveValue("");
  });

  it("envia uma sugestão com um clique", async () => {
    post.mockResolvedValue({ data: { reply: "Tudo certo." } });
    render(<AssistantPage />);

    await userEvent.click(screen.getByRole("button", { name: "Como estão minhas metas?" }));

    expect(await screen.findByText("Tudo certo.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Onde posso economizar?" })).toBeNull();
  });

  it("mantém o histórico entre as perguntas", async () => {
    post.mockResolvedValueOnce({ data: { reply: "Primeira." } });
    post.mockResolvedValueOnce({ data: { reply: "Segunda." } });
    render(<AssistantPage />);

    await type("Um");
    await submit();
    await screen.findByText("Primeira.");
    await type("Dois");
    await submit();
    await screen.findByText("Segunda.");

    expect(post).toHaveBeenLastCalledWith("/agent/chat", {
      messages: [
        { role: "user", content: "Um" },
        { role: "assistant", content: "Primeira." },
        { role: "user", content: "Dois" },
      ],
    });
  });

  it("devolve o texto ao campo quando falha", async () => {
    post.mockRejectedValue(new Error("falha"));
    render(<AssistantPage />);

    await type("Quanto gastei?");
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("não conseguiu responder");
    expect(screen.getByLabelText("Pergunta para o assistente")).toHaveValue("Quanto gastei?");
    await waitFor(() => expect(screen.queryByText("Quanto gastei?")).toBeNull());
  });

  it("não envia pergunta em branco", () => {
    render(<AssistantPage />);

    expect(screen.getByLabelText("Enviar pergunta")).toBeDisabled();
  });

  it("corta o histórico longo começando em uma mensagem da pessoa", async () => {
    post.mockImplementation(async () => ({ data: { reply: "ok" } }));
    render(<AssistantPage />);

    for (let turn = 0; turn < 11; turn += 1) {
      await type(`p${turn}`);
      await submit();
      await waitFor(() => expect(post).toHaveBeenCalledTimes(turn + 1));
      await waitFor(() => expect(screen.getByLabelText("Enviar pergunta")).toBeDisabled());
      await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    }

    const sent = post.mock.calls.at(-1)?.[1] as { messages: Array<{ role: string }> };
    expect(sent.messages).toHaveLength(19);
    expect(sent.messages[0]?.role).toBe("user");
  });
});
