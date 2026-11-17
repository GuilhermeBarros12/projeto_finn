import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./DatePicker";

function Harness({ onChange, min }: { onChange?: (value: string) => void; min?: string }) {
  const [value, setValue] = useState("2026-11-16");
  return (
    <form>
      <DatePicker
        name="date"
        label="Data"
        value={value}
        min={min}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    </form>
  );
}

const hiddenValue = () => document.querySelector<HTMLInputElement>('input[name="date"]')?.value;

describe("DatePicker", () => {
  it("mostra a data por extenso e guarda AAAA-MM-DD num input escondido", () => {
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Data" })).toHaveTextContent("seg, 16/11/2026");
    expect(hiddenValue()).toBe("2026-11-16");
  });

  it("abre, vai ao mês seguinte, escolhe um dia e atualiza o valor", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Data" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await user.click(screen.getByRole("button", { name: "10 de dezembro de 2026" }));

    expect(onChange).toHaveBeenCalledWith("2026-12-10");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hiddenValue()).toBe("2026-12-10");
  });

  it("marca o dia escolhido e fecha com Esc", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Data" }));
    expect(screen.getByRole("button", { name: "16 de novembro de 2026" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("move o foco com as setas e escolhe com Enter", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Data" }));
    await user.keyboard("{ArrowRight}{Enter}");

    expect(onChange).toHaveBeenCalledWith("2026-11-17");
  });

  it("desabilita os dias antes de min", async () => {
    const user = userEvent.setup();
    render(<Harness min="2026-11-10" />);

    await user.click(screen.getByRole("button", { name: "Data" }));

    expect(screen.getByRole("button", { name: "9 de novembro de 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "10 de novembro de 2026" })).toBeEnabled();
  });
});
