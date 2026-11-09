import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

const renderModal = () =>
  render(
    <Modal title="Teste" onClose={vi.fn()}>
      conteúdo
    </Modal>,
  );

describe("Modal", () => {
  it("trava a rolagem da página enquanto está aberto e destrava ao fechar", () => {
    const modal = renderModal();
    expect(document.body.style.overflow).toBe("hidden");

    modal.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("só destrava quando o último de dois modais sobrepostos fecha", () => {
    const first = renderModal();
    const second = renderModal();

    first.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    second.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("não usa desfoque de fundo, que deixa a rolagem lenta", () => {
    const { getByRole } = renderModal();

    expect(getByRole("dialog").className).not.toContain("backdrop-blur");
  });
});
