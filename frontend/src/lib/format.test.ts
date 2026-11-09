import axios, { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { apiErrorMessage, formatDate, money, todayInput } from "./format";

const httpError = (status: number, data: unknown) =>
  new AxiosError("falha", "ERR", undefined, undefined, {
    status,
    data,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

describe("datas no fuso de Brasília", () => {
  it("usa um fuso diferente de UTC nos testes", () => {
    expect(new Date("2026-11-05T00:00:00.000Z").getHours()).toBe(21);
  });

  it("mostra o dia lançado, não o anterior", () => {
    expect(formatDate("2026-11-05T00:00:00.000Z")).toBe("05/11/2026");
  });

  it("usa o dia local à noite, quando em UTC já é amanhã", () => {
    expect(todayInput(new Date(2026, 10, 5, 22, 30))).toBe("2026-11-05");
  });
});

describe("mensagens de erro", () => {
  it("prioriza o motivo específico da validação", () => {
    const error = httpError(400, {
      message: "Dados de entrada inválidos.",
      issues: [{ message: "A senha deve ter pelo menos 8 caracteres." }],
    });

    expect(apiErrorMessage(error, "padrão")).toBe("A senha deve ter pelo menos 8 caracteres.");
  });

  it("usa a mensagem da API e, sem ela, o texto padrão", () => {
    expect(apiErrorMessage(httpError(401, { message: "Senha inválida" }), "padrão")).toBe(
      "Senha inválida",
    );
    expect(apiErrorMessage(httpError(500, ""), "padrão")).toBe("padrão");
    expect(apiErrorMessage(new Error("x"), "padrão")).toBe("padrão");
  });

  it("explica quando o servidor está inacessível", () => {
    expect(axios.isAxiosError(new AxiosError("rede"))).toBe(true);
    expect(apiErrorMessage(new AxiosError("rede"), "padrão")).toContain("conectar");
  });
});

describe("moeda", () => {
  it("formata em reais", () => {
    expect(money(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });
});
