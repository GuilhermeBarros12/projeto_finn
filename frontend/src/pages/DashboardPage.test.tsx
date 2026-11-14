import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api } from "../api";
import DashboardPage from "./DashboardPage";

vi.mock("../api", () => ({ api: { get: vi.fn() } }));

describe("DashboardPage", () => {
  it("não mostra R$ 0,00 como se fosse real quando o painel falha", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("falha"));
    render(<DashboardPage categories={[]} onCategories={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText(/R\$\s?0,00/)).toBeNull();
  });
});
