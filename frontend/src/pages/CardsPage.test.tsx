import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import type { Card, CardOverview, Invoice, InvoiceSummary } from "../types";
import CardsPage, { CardDetailPage } from "./CardsPage";

vi.mock("../api", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));

const summary = (overrides: Partial<InvoiceSummary>): InvoiceSummary => ({
  ref: { year: 2026, month: 12 },
  start: "2026-10-25",
  end: "2026-11-24",
  closingDate: "2026-11-25",
  dueDate: "2026-12-05",
  status: "OPEN",
  total: 1234.56,
  transactionsCount: 3,
  ...overrides,
});

const overviewItem = (confirmed: string | null): CardOverview => ({
  card: {
    id: "c1",
    name: "Nubank",
    closingDay: 25,
    dueDay: 5,
    isDefault: true,
    datesConfirmedAt: confirmed,
  },
  current: summary({}),
  next: summary({
    ref: { year: 2027, month: 1 },
    total: 800,
    dueDate: "2027-01-05",
    status: "FUTURE",
  }),
});

const card: Card = {
  id: "c1",
  name: "Nubank",
  closingDay: 25,
  dueDay: 5,
  isDefault: true,
  status: true,
  datesConfirmedAt: "2026-01-01T00:00:00.000Z",
};

const invoice = (month: number, year = 2026): Invoice => ({
  ...summary({ ref: { year, month } }),
  card: { id: "c1", name: "Nubank", closingDay: 25, dueDay: 5 },
  transactions: [],
});

const mockOverview = (item: CardOverview) =>
  vi.mocked(api.get).mockImplementation((async (url: string) => {
    if (url === "/cards/overview") return { data: { cards: [item] } };
    throw new Error(`url inesperada: ${url}`);
  }) as never);

const renderList = () =>
  render(
    <MemoryRouter>
      <CardsPage cards={[card]} refreshCards={vi.fn().mockResolvedValue(undefined)} />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.mocked(api.get).mockReset();
});

describe("CardsPage", () => {
  it("mostra a fatura atual e a próxima com os valores do overview", async () => {
    mockOverview(overviewItem("2026-01-01T00:00:00.000Z"));
    renderList();

    expect(await screen.findByText(/1\.234,56/)).toBeInTheDocument();
    expect(screen.getByText(/800,00/)).toBeInTheDocument();
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("Fecha dia 25 · vence dia 5")).toBeInTheDocument();
    expect(screen.getByText(/Vence em 05\/01/)).toBeInTheDocument();
    expect(screen.queryByText(/Confira os dias/)).not.toBeInTheDocument();
  });

  it("avisa quando as datas não foram confirmadas e abre o ajuste", async () => {
    mockOverview(overviewItem(null));
    renderList();

    expect(await screen.findByText(/Confira os dias de fechamento/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ajustar agora" }));

    expect(screen.getByRole("heading", { name: "Ajustar cartão" })).toBeInTheDocument();
  });

  it("sem cartões mostra o estado vazio", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { cards: [] } });
    render(
      <MemoryRouter>
        <CardsPage cards={[]} refreshCards={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Nenhum cartão cadastrado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar primeiro cartão" })).toBeInTheDocument();
  });
});

describe("CardDetailPage", () => {
  it("navega para o mês seguinte e muda a query", async () => {
    vi.mocked(api.get).mockImplementation((async (url: string) => {
      const [, , , , , year, month] = url.split("/");
      return { data: { invoice: invoice(Number(month), Number(year)) } };
    }) as never);

    render(
      <MemoryRouter initialEntries={["/cartoes/c1?ano=2026&mes=12"]}>
        <Routes>
          <Route
            path="/cartoes/:cardId"
            element={<CardDetailPage cards={[card]} categories={[]} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Fatura de dezembro de 2026")).toBeInTheDocument();
    expect(screen.getByText("Nenhum lançamento nesta fatura.")).toBeInTheDocument();
    expect(screen.getByText(/Compras de 25\/10 a 24\/11/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Próxima fatura" }));

    expect(await screen.findByText("Fatura de janeiro de 2027")).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith("/cards/c1/invoices/2027/1"));
  });

  it("sem query busca a fatura atual", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { invoice: invoice(12) } });

    render(
      <MemoryRouter initialEntries={["/cartoes/c1"]}>
        <Routes>
          <Route
            path="/cartoes/:cardId"
            element={<CardDetailPage cards={[card]} categories={[]} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Fatura de dezembro de 2026")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/cards/c1/invoices/current");
  });
});
