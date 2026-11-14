import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import type { Category, Goal } from "../types";
import { GoalModal } from "./GoalModal";

vi.mock("../api", () => ({ api: { post: vi.fn(), put: vi.fn() } }));

const active: Category = {
  id: "ativa",
  code: "A",
  name: "Mercado",
  type: "EXPENSE",
  icon: "Tag",
  color: "#000000",
  status: true,
};

const goal: Goal = {
  id: "m1",
  title: "Limite antigo",
  type: "SPENDING_LIMIT",
  targetValue: "100.00",
  dueDate: "2099-12-31T00:00:00.000Z",
  status: "IN_PROGRESS",
  categoryId: "antiga",
  category: { id: "antiga", name: "Antiga", status: false },
  currentValue: 0,
  progress: 0,
};

beforeEach(() => {
  vi.mocked(api.put).mockReset();
});

describe("GoalModal", () => {
  it("salva meta de categoria desativada sem trocar a categoria (GOAL-02)", async () => {
    vi.mocked(api.put).mockResolvedValue({});
    const onClose = vi.fn();
    render(<GoalModal categories={[active]} initial={goal} onClose={onClose} onSaved={vi.fn()} />);

    expect(screen.getByLabelText("Categoria")).toHaveDisplayValue("Antiga (desativada)");
    await userEvent.click(screen.getByRole("button", { name: "Salvar meta" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.put).toHaveBeenCalledWith(
      "/goals/m1",
      expect.objectContaining({ categoryId: "antiga", dueDate: "2099-12-31" }),
    );
  });

  it("não oferece categoria desativada em meta nova", async () => {
    render(<GoalModal categories={[active]} onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Limite de gasto" }));

    expect(screen.queryByRole("option", { name: /desativada/ })).toBeNull();
    expect(screen.getByRole("option", { name: "Mercado" })).toBeInTheDocument();
  });
});
