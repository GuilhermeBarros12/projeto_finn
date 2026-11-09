import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, clearSession, setAccessToken, setSessionExpiredHandler } from "./api";

const unauthorized = (config: InternalAxiosRequestConfig) =>
  new AxiosError("401", "ERR", config, undefined, {
    status: 401,
    data: {},
    statusText: "",
    headers: {},
    config,
  });

const respond = (config: InternalAxiosRequestConfig) => ({
  data: { authorization: config.headers.get("Authorization") },
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config,
});

const refreshPost = vi.spyOn(axios, "post");

beforeEach(() => {
  clearSession();
  setSessionExpiredHandler(() => undefined);
  refreshPost.mockReset();
});

afterEach(() => {
  api.defaults.adapter = undefined;
});

describe("sessão no cliente HTTP", () => {
  it("renova uma vez e repete a requisição com o token novo", async () => {
    setAccessToken("expirado");
    refreshPost.mockResolvedValue({ data: { token: "novo" } });
    api.defaults.adapter = async (config) => {
      if (config.headers.get("Authorization") === "Bearer expirado") throw unauthorized(config);
      return respond(config);
    };

    const response = await api.get("/transactions");

    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(response.data.authorization).toBe("Bearer novo");
  });

  it("compartilha uma renovação entre requisições simultâneas", async () => {
    setAccessToken("expirado");
    refreshPost.mockResolvedValue({ data: { token: "novo" } });
    api.defaults.adapter = async (config) => {
      if (config.headers.get("Authorization") === "Bearer expirado") throw unauthorized(config);
      return respond(config);
    };

    await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);

    expect(refreshPost).toHaveBeenCalledTimes(1);
  });

  it("avisa que a sessão expirou quando a renovação falha", async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    setAccessToken("expirado");
    refreshPost.mockRejectedValue(new Error("sem sessão"));
    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(api.get("/transactions")).rejects.toThrow();

    expect(expired).toHaveBeenCalledTimes(1);
  });

  it("não tenta renovar quando o próprio login falha", async () => {
    api.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(api.post("/auth/login", {})).rejects.toThrow();

    expect(refreshPost).not.toHaveBeenCalled();
  });

  it("não entra em laço se a repetição também der 401", async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    let calls = 0;
    refreshPost.mockResolvedValue({ data: { token: "novo" } });
    api.defaults.adapter = async (config) => {
      calls += 1;
      throw unauthorized(config);
    };

    await expect(api.get("/transactions")).rejects.toThrow();

    expect(calls).toBe(2);
  });
});
