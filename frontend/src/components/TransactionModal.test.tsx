import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import type { Category, Transaction } from "../types";
import { TransactionModal } from "./TransactionModal";

vi.mock("../api", () => ({ api: { post: vi.fn(), put: vi.fn() } }));

const category = (id: string, type: Category["type"], status = true): Category => ({
  id,
  code: id,
  name: `Categoria ${id}`,
  type,
  icon: "Tag",
  color: "#000000",
  status,
});

const categories = [category("gasto", "EXPENSE"), category("salario", "INCOME")];

const inactiveTransaction: Transaction = {
  id: "t1",
  categoryId: "antiga",
  type: "EXPENSE",
  description: "Antiga",
  value: "45.90",
  date: "2026-03-15T00:00:00.000Z",
  paymentMethod: "PIX",
  category: { id: "antiga", name: "Antiga", icon: "Tag", color: "#000000" },
};

beforeEach(() => {
  vi.mocked(api.post).mockReset();
  vi.mocked(api.put).mockReset();
});

describe("TransactionModal", () => {
  it("abre como receita quando pedido (botão Adicionar dinheiro)", () => {
    render(
      <TransactionModal
        categories={categories}
        defaultType="INCOME"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Receita" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("option", { name: "Categoria salario" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Categoria gasto" })).not.toBeInTheDocument();
  });

  it("preenche a data de hoje no calendário local", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 5, 22, 30), toFake: ["Date"] });
    render(<TransactionModal categories={categories} onClose={vi.fn()} onSaved={vi.fn()} />);
    vi.useRealTimers();

    expect(screen.getByLabelText("Data")).toHaveValue("2026-11-05");
  });

  it("salva transação de categoria desativada sem trocar a categoria (bug 5)", async () => {
    vi.mocked(api.put).mockResolvedValue({});
    const onClose = vi.fn();
    render(
      <TransactionModal
        categories={categories}
        initial={inactiveTransaction}
        onClose={onClose}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Categoria")).toHaveDisplayValue("Antiga (desativada)");
    await userEvent.click(screen.getByRole("button", { name: "Salvar transação" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith(
      "/transactions/t1",
      expect.objectContaining({ categoryId: "antiga", value: 45.9, date: "2026-03-15" }),
    );
  });

  it("limpa a categoria ao trocar o tipo", async () => {
    render(
      <TransactionModal
        categories={categories}
        initial={inactiveTransaction}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Receita" }));

    expect(screen.getByLabelText("Categoria")).toHaveValue("");
  });

  it("recusa valor zerado sem chamar a API", async () => {
    render(<TransactionModal categories={categories} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Descrição"), "Teste");
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "gasto" } });
    await userEvent.click(screen.getByRole("button", { name: "Salvar transação" }));

    expect(screen.getByRole("alert")).toHaveTextContent("valor positivo");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("fecha com a tecla Esc", async () => {
    const onClose = vi.fn();
    render(<TransactionModal categories={categories} onClose={onClose} onSaved={vi.fn()} />);

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });
});
