import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, clearSession } from "./api";
import { App } from "./App";

vi.mock("./api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  clearSession: vi.fn(),
  refreshSession: vi.fn().mockResolvedValue("token"),
  setAccessToken: vi.fn(),
  setSessionExpiredHandler: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(api.post).mockReset();
  vi.mocked(clearSession).mockReset();
  vi.mocked(api.get).mockResolvedValue({
    data: { categories: [], data: [], totalIncome: 0, totalExpense: 0, netBalance: 0 },
  });
});

const clickSignOut = async () =>
  userEvent.click(await screen.findByRole("button", { name: "Sair" }));

describe("saída da conta", () => {
  it("avisa e mantém a sessão quando o servidor não confirma a saída", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("sem rede"));
    render(<App />);

    await clickSignOut();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível sair");
    expect(clearSession).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();
  });

  it("permite tentar de novo e só então volta ao login", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("sem rede"));
    vi.mocked(api.post).mockResolvedValueOnce({});
    render(<App />);

    await clickSignOut();
    await screen.findByRole("alert");
    await clickSignOut();

    expect(await screen.findByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });
});

describe("carregamento de categorias (UI-02)", () => {
  it("avisa a falha em vez de mostrar uma conta sem categorias e permite tentar de novo", async () => {
    let failCategories = true;
    vi.mocked(api.get).mockImplementation((async (url: string) => {
      if (url === "/categories") {
        if (failCategories) throw new Error("falha");
        return { data: { categories: [] } };
      }
      return { data: { data: [], totalIncome: 0, totalExpense: 0, netBalance: 0 } };
    }) as never);
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("categorias");

    failCategories = false;
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(api.get).toHaveBeenCalledWith("/categories", { params: { includeInactive: true } });
  });
});
