import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { api } from "../api";
import type { Goal } from "../types";
import GoalsPage from "./GoalsPage";

vi.mock("../api", () => ({ api: { get: vi.fn(), delete: vi.fn() } }));

const goal = (index: number): Goal => ({
  id: `m${index}`,
  title: `Meta ${index}`,
  type: "SAVINGS",
  targetValue: "100.00",
  dueDate: "2099-12-31T00:00:00.000Z",
  status: "IN_PROGRESS",
  categoryId: null,
  category: null,
  currentValue: 0,
  progress: 0,
});

describe("GoalsPage (GOAL-03)", () => {
  it("carrega as metas além da primeira página", async () => {
    vi.mocked(api.get).mockImplementation((async (
      _url: string,
      options: { params: { page: number } },
    ) => {
      const page = options.params.page;
      const all = Array.from({ length: 21 }, (_, index) => goal(index + 1));
      return { data: { data: all.slice((page - 1) * 20, page * 20), meta: { total: 21 } } };
    }) as never);
    render(<GoalsPage categories={[]} />);

    await screen.findByText("Meta 1");
    expect(screen.queryByText("Meta 21")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /Carregar mais metas/ }));

    expect(await screen.findByText("Meta 21")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(21);
    expect(screen.queryByRole("button", { name: /Carregar mais metas/ })).toBeNull();
  });
});
