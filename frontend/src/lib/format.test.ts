import axios, { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { apiErrorMessage, currentMonth, formatDate, money, todayInput } from "./format";

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

describe("fuso do app (DATE-02)", () => {
  // 01/12 às 01h em UTC ainda é 30/11 em Brasília e já é 01/12 em Tóquio.
  const virada = new Date("2026-12-01T01:00:00.000Z");

  it("usa o fuso do app, não o do navegador", () => {
    expect(todayInput(virada)).toBe("2026-11-30");
    expect(currentMonth(virada)).toEqual({ month: 11, year: 2026 });
  });

  it("muda de mês quando o fuso configurado muda", () => {
    expect(todayInput(virada, "Asia/Tokyo")).toBe("2026-12-01");
    expect(currentMonth(virada, "Asia/Tokyo")).toEqual({ month: 12, year: 2026 });
  });
});
