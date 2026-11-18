import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, fetchSession, setSessionExpiredHandler } from "./api";

const unauthorized = (config: InternalAxiosRequestConfig) =>
  new AxiosError("401", "ERR", config, undefined, {
    status: 401,
    data: {},
    statusText: "",
    headers: {},
    config,
  });

const ok = (config: InternalAxiosRequestConfig, data: unknown) => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config,
});

beforeEach(() => {
  setSessionExpiredHandler(() => undefined);
});

afterEach(() => {
  api.defaults.adapter = undefined;
});

describe("sessão no cliente HTTP", () => {
  it("avisa que a sessão expirou quando uma rota protegida responde 401", async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(api.get("/transactions")).rejects.toThrow();

    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("não trata como sessão vencida o 401 do próprio login", async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(api.post("/auth/sign-in/email", {})).rejects.toThrow();

    expect(expired).not.toHaveBeenCalled();
  });

  it("não encerra a sessão por erro de servidor ou de rede", async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    api.defaults.adapter = async () => {
      throw new AxiosError("sem rede");
    };

    await expect(api.get("/transactions")).rejects.toThrow();

    expect(expired).not.toHaveBeenCalled();
  });

  it("reconhece a sessão ativa e a ausência de sessão", async () => {
    api.defaults.adapter = async (config) => ok(config, { user: { id: "u1" }, session: {} });
    expect(await fetchSession()).toBe(true);

    api.defaults.adapter = async (config) => ok(config, null);
    expect(await fetchSession()).toBe(false);
  });
});
