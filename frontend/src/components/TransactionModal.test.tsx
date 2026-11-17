import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import type { Card, Category, Transaction } from "../types";
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
  cardId: null,
  card: null,
  installmentGroupId: null,
  installmentNumber: null,
  installmentCount: null,
  recurrenceId: null,
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

    expect(screen.getByRole("button", { name: "Data" })).toHaveTextContent("qui, 05/11/2026");
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

  describe("cartão, parcelas e recorrência", () => {
    const card = (id: string, name: string, isDefault = false, status = true): Card => ({
      id,
      name,
      closingDay: 25,
      dueDay: 5,
      isDefault,
      status,
      datesConfirmedAt: "2026-01-01T00:00:00.000Z",
    });
    const cards = [card("c1", "Nubank"), card("c2", "Itaú", true)];

    const fillBasics = async (value = "10000") => {
      await userEvent.type(screen.getByLabelText("Descrição"), "Notebook");
      await userEvent.type(screen.getByLabelText("Valor em reais"), value);
      fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "gasto" } });
    };

    const renderCredit = (extra: Partial<Parameters<typeof TransactionModal>[0]> = {}) =>
      render(
        <TransactionModal
          categories={categories}
          cards={cards}
          defaultOrigin="CREDIT_CARD"
          onClose={vi.fn()}
          onSaved={vi.fn()}
          {...extra}
        />,
      );

    it("pré-seleciona o cartão padrão quando a origem é cartão", () => {
      renderCredit();

      expect(screen.getByLabelText("Cartão")).toHaveDisplayValue("Itaú");
    });

    it("sem cartão ativo, avisa e bloqueia o salvamento", () => {
      renderCredit({ cards: [] });

      expect(screen.getByRole("status")).toHaveTextContent("Cadastre um cartão");
      expect(screen.getByRole("button", { name: "Salvar transação" })).toBeDisabled();
    });

    it("receita não oferece Parcelado", async () => {
      renderCredit();
      expect(screen.getByRole("button", { name: "Parcelado" })).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Receita" }));

      expect(screen.queryByRole("button", { name: "Parcelado" })).not.toBeInTheDocument();
    });

    it("mostra o preview de R$ 100,00 em 3x e envia o corpo esperado", async () => {
      vi.mocked(api.post).mockResolvedValue({});
      renderCredit();
      await fillBasics();
      await userEvent.click(screen.getByRole("button", { name: "Parcelado" }));
      fireEvent.change(screen.getByLabelText("Número de parcelas"), { target: { value: "3" } });

      const items = screen.getAllByText(/^\d\/3 · /).map((item) => item.textContent ?? "");
      expect(items).toHaveLength(3);
      expect(items[0]).toMatch(/^1\/3 · \d{2}\/\d{2}\/\d{4} · R\$\s33,34$/);
      expect(items[1]).toMatch(/R\$\s33,33$/);
      expect(items[2]).toMatch(/R\$\s33,33$/);
      expect(screen.getByText(/Total: R\$\s100,00/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Salvar transação" }));

      await waitFor(() => expect(api.post).toHaveBeenCalled());
      expect(api.post).toHaveBeenCalledWith(
        "/transactions",
        expect.objectContaining({
          value: 100,
          paymentMethod: "CREDIT_CARD",
          cardId: "c2",
          mode: "INSTALLMENTS",
          installments: { count: 3, valueMode: "TOTAL" },
        }),
      );
    });

    it("envia PER_INSTALLMENT no modo valor da parcela", async () => {
      vi.mocked(api.post).mockResolvedValue({});
      renderCredit();
      await fillBasics("5000");
      await userEvent.click(screen.getByRole("button", { name: "Parcelado" }));
      await userEvent.click(screen.getByRole("radio", { name: "Valor da parcela" }));
      fireEvent.change(screen.getByLabelText("Número de parcelas"), { target: { value: "4" } });

      expect(screen.getByLabelText("Valor de cada parcela")).toBeInTheDocument();
      expect(screen.getByText(/Total: R\$\s200,00/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Salvar transação" }));

      await waitFor(() => expect(api.post).toHaveBeenCalled());
      expect(api.post).toHaveBeenCalledWith(
        "/transactions",
        expect.objectContaining({
          value: 50,
          installments: { count: 4, valueMode: "PER_INSTALLMENT" },
        }),
      );
    });

    it("recorrente envia mode e a data final quando definida", async () => {
      vi.mocked(api.post).mockResolvedValue({});
      render(<TransactionModal categories={categories} onClose={vi.fn()} onSaved={vi.fn()} />);
      await fillBasics();
      await userEvent.click(screen.getByRole("button", { name: "Recorrente" }));

      expect(screen.getByText("Repete todo mês, por 12 meses.")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Definir data final" }));
      await userEvent.click(screen.getByRole("button", { name: "Salvar transação" }));

      await waitFor(() => expect(api.post).toHaveBeenCalled());
      const body = vi.mocked(api.post).mock.calls[0]?.[1] as Record<string, unknown>;
      expect(body.mode).toBe("RECURRING");
      expect(body.recurrence).toEqual({ endDate: body.date });
      expect(body).not.toHaveProperty("cardId");
    });

    it("editar a parcela 2 de 5 com 'Este e os seguintes' envia scope=FOLLOWING sem a data", async () => {
      vi.mocked(api.put).mockResolvedValue({});
      const parcela: Transaction = {
        ...inactiveTransaction,
        categoryId: "gasto",
        category: { id: "gasto", name: "Categoria gasto", icon: "Tag", color: "#000000" },
        paymentMethod: "CREDIT_CARD",
        cardId: "c1",
        card: { id: "c1", name: "Nubank" },
        installmentGroupId: "g1",
        installmentNumber: 2,
        installmentCount: 5,
      };
      render(
        <TransactionModal
          categories={categories}
          cards={cards}
          initial={parcela}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );

      expect(screen.getByText("Parcela 2 de 5")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("radio", { name: "Este e os seguintes" }));
      expect(screen.getByRole("button", { name: "Data" })).toBeDisabled();
      await userEvent.click(screen.getByRole("button", { name: "Salvar transação" }));

      await waitFor(() => expect(api.put).toHaveBeenCalled());
      const [url, body, config] = vi.mocked(api.put).mock.calls[0] as [
        string,
        Record<string, unknown>,
        unknown,
      ];
      expect(url).toBe("/transactions/t1");
      expect(body).not.toHaveProperty("date");
      expect(config).toEqual({ params: { scope: "FOLLOWING" } });
    });
  });
});
