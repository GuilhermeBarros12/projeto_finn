import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { api } from "../api";
import DashboardPage from "./DashboardPage";

vi.mock("../api", () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

describe("DashboardPage", () => {
  it("não mostra R$ 0,00 como se fosse real quando o painel falha", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("falha"));
    render(<DashboardPage categories={[]} onCategories={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText(/R\$\s?0,00/)).toBeNull();
  });

  it("avisa a recorrência que está acabando e renova por 12 meses", async () => {
    vi.mocked(api.post).mockResolvedValue({});
    vi.mocked(api.get).mockImplementation((async (url: string) => {
      if (url === "/recurrences/ending") {
        return {
          data: {
            recurrences: [
              {
                id: "r1",
                description: "Netflix",
                value: 55,
                type: "EXPENSE",
                lastDate: "2027-01-10",
                cardName: null,
              },
            ],
          },
        };
      }
      if (url === "/dashboard/summary") {
        return { data: { totalIncome: 0, totalExpense: 0, netBalance: 0 } };
      }
      return { data: { data: [] } };
    }) as never);
    render(<DashboardPage categories={[]} onCategories={vi.fn()} />);

    expect(await screen.findByText(/Netflix termina em 01\/2027\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Renovar por 12 meses" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/recurrences/r1/renew"));
    await waitFor(() => expect(screen.queryByText(/Netflix termina/)).not.toBeInTheDocument());
  });

  it("'Deixar terminar' chama o encerramento", async () => {
    vi.mocked(api.patch).mockResolvedValue({});
    vi.mocked(api.get).mockImplementation((async (url: string) => {
      if (url === "/recurrences/ending") {
        return {
          data: {
            recurrences: [
              {
                id: "r2",
                description: "Academia",
                value: 90,
                type: "EXPENSE",
                lastDate: "2027-02-05",
                cardName: "Nubank",
              },
            ],
          },
        };
      }
      if (url === "/dashboard/summary") {
        return { data: { totalIncome: 0, totalExpense: 0, netBalance: 0 } };
      }
      return { data: { data: [] } };
    }) as never);
    render(<DashboardPage categories={[]} onCategories={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Deixar terminar" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/recurrences/r2/finish"));
  });
});
