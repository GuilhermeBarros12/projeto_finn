import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import type { Category } from "../types";
import TransactionsPage from "./TransactionsPage";

vi.mock("../api", () => ({ api: { get: vi.fn(), delete: vi.fn() } }));
vi.mock("../components/TransactionCharts", () => ({ default: () => null }));

const category = (id: string, name: string, status: boolean): Category => ({
  id,
  code: id,
  name,
  type: "EXPENSE",
  icon: "Tag",
  color: "#000000",
  status,
});

const transaction = {
  id: "t1",
  categoryId: "c1",
  type: "EXPENSE",
  description: "Feira",
  value: "10.00",
  date: "2026-03-15T00:00:00.000Z",
  paymentMethod: "PIX",
  category: { id: "c1", name: "Mercado", icon: "Tag", color: "#000000" },
};

let failTransactions = false;
let failExport = false;

beforeEach(() => {
  failTransactions = false;
  failExport = false;
  vi.mocked(api.get).mockImplementation((async (url: string) => {
    if (url === "/transactions") {
      if (failTransactions) throw new Error("falha");
      return {
        data: { data: [transaction], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } },
      };
    }
    if (url === "/exports/transactions") {
      if (failExport) throw new Error("falha");
      return { data: new Blob(["x"]) };
    }
    if (url === "/dashboard/by-category") return { data: { categories: [] } };
    return { data: { account: 0, creditCard: 0 } };
  }) as never);
});

const renderPage = () =>
  render(
    <TransactionsPage
      type="EXPENSE"
      categories={[category("c1", "Mercado", true), category("c2", "Antiga", false)]}
    />,
  );

describe("TransactionsPage", () => {
  it("não mostra dados do filtro anterior quando a nova busca falha (UI-01)", async () => {
    renderPage();
    await screen.findByText("Feira");

    failTransactions = true;
    await userEvent.selectOptions(screen.getByLabelText("Mês"), "4");

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    expect(screen.queryByText("Feira")).toBeNull();
    expect(screen.queryByText(/Nenhuma despesa/)).toBeNull();
  });

  it("permite tentar de novo depois da falha", async () => {
    failTransactions = true;
    renderPage();
    await screen.findByRole("alert");

    failTransactions = false;
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(await screen.findByText("Feira")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mantém a lista quando só a exportação falha", async () => {
    renderPage();
    await screen.findByText("Feira");

    failExport = true;
    await userEvent.click(screen.getByRole("button", { name: /Exportar CSV/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível exportar");
    expect(screen.getByText("Feira")).toBeInTheDocument();
  });

  it("oferece categorias desativadas no filtro do histórico (UI-04)", () => {
    renderPage();

    expect(screen.getByRole("option", { name: "Antiga (desativada)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Mercado" })).toBeInTheDocument();
  });
});
