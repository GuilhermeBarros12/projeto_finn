import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { CategoryModal } from "./CategoryModal";

vi.mock("../api", () => ({ api: { post: vi.fn(), patch: vi.fn() } }));

const post = vi.mocked(api.post);

beforeEach(() => {
  post.mockReset();
});

describe("CategoryModal", () => {
  it("cria a categoria sem mostrar erro falso e limpa o formulário (bug 2)", async () => {
    post.mockResolvedValue({ data: { category: { code: "ABC123" } } });
    const onChanged = vi.fn();
    render(<CategoryModal categories={[]} onClose={vi.fn()} onChanged={onChanged} />);

    const name = screen.getByLabelText("Nome da categoria");
    await userEvent.type(name, "Pets");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar categoria" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ABC123"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(name).toHaveValue("");
  });

  it("mostra o erro real quando a API recusa", async () => {
    post.mockRejectedValue(new Error("falha"));
    render(<CategoryModal categories={[]} onClose={vi.fn()} onChanged={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Nome da categoria"), "Pets");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar categoria" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível criar");
  });
});

describe("CategoryModal com falhas e desativadas", () => {
  const inactive = {
    id: "c2",
    userId: "u1",
    code: "ANT",
    name: "Antiga",
    type: "EXPENSE" as const,
    icon: "Tag",
    color: "#000000",
    status: false,
  };

  it("não trata como erro de criação a falha ao recarregar a lista (UI-03)", async () => {
    post.mockResolvedValue({ data: { category: { code: "XYZ789" } } });
    const onChanged = vi.fn().mockRejectedValue(new Error("lista falhou"));
    render(<CategoryModal categories={[]} onClose={vi.fn()} onChanged={onChanged} />);

    await userEvent.type(screen.getByLabelText("Nome da categoria"), "Pets");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar categoria" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("foi criada");
    expect(screen.getByRole("status")).toHaveTextContent("XYZ789");
  });

  it("mostra a categoria desativada sem o botão de desativar (UI-04)", () => {
    render(<CategoryModal categories={[inactive]} onClose={vi.fn()} onChanged={vi.fn()} />);

    expect(screen.getByText("Desativada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desativar" })).toBeNull();
  });
});
