import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { CardModal } from "./CardModal";

vi.mock("../api", () => ({ api: { post: vi.fn(), put: vi.fn(), patch: vi.fn() } }));

beforeEach(() => {
  vi.mocked(api.post).mockReset();
  vi.mocked(api.put).mockReset();
  vi.mocked(api.patch).mockReset();
});

describe("CardModal", () => {
  it("recusa fechamento igual ao vencimento sem chamar a API", async () => {
    render(<CardModal onClose={vi.fn()} onSaved={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Nome do cartão"), "Nubank");
    await userEvent.selectOptions(screen.getByLabelText("Dia do vencimento"), "25");
    await userEvent.click(screen.getByRole("button", { name: "Salvar cartão" }));

    expect(screen.getByRole("alert")).toHaveTextContent("precisam ser diferentes");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("envia o POST esperado e avisa a página", async () => {
    vi.mocked(api.post).mockResolvedValue({});
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<CardModal onClose={onClose} onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Nome do cartão"), "Nubank");
    await userEvent.selectOptions(screen.getByLabelText("Dia do fechamento"), "20");
    await userEvent.selectOptions(screen.getByLabelText("Dia do vencimento"), "28");
    await userEvent.click(screen.getByLabelText("Usar como cartão padrão"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar cartão" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith("/cards", {
      name: "Nubank",
      closingDay: 20,
      dueDay: 28,
      isDefault: true,
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("explica a regra do fechamento e dos meses curtos", async () => {
    render(<CardModal onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(
      screen.getByText(/Compras feitas a partir do dia 25 entram na fatura seguinte\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/meses mais curtos/)).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Dia do fechamento"), "31");

    expect(
      screen.getByText(/Nos meses mais curtos, vale o último dia do mês\./),
    ).toBeInTheDocument();
  });

  it("na edição, desativar pede confirmação", async () => {
    vi.mocked(api.patch).mockResolvedValue({});
    const onClose = vi.fn();
    render(
      <CardModal
        card={{ id: "c1", name: "Nubank", closingDay: 25, dueDay: 5, isDefault: true }}
        onClose={onClose}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Tornar padrão" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Desativar cartão" }));
    expect(api.patch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/cards/c1/deactivate"));
  });
});
