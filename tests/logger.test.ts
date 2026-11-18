import { describe, expect, it } from "vitest";
import { maskSecretsInUrl } from "../src/lib/logger";

describe("segredos no log", () => {
  it("esconde o token do link de redefinição, com ou sem consulta", () => {
    expect(maskSecretsInUrl("/api/auth/reset-password/abc123XYZ?callbackURL=%2Fx")).toBe(
      "/api/auth/reset-password/[redacted]?callbackURL=%2Fx",
    );
    expect(maskSecretsInUrl("/api/auth/reset-password/abc123XYZ")).toBe(
      "/api/auth/reset-password/[redacted]",
    );
  });

  it("esconde o código e o estado do retorno do Google", () => {
    expect(maskSecretsInUrl("/api/auth/callback/google?code=4%2F0AbC&state=xyz&scope=email")).toBe(
      "/api/auth/callback/google?code=[redacted]&state=[redacted]&scope=email",
    );
  });

  it("não mexe nas outras rotas", () => {
    expect(maskSecretsInUrl("/api/auth/reset-password")).toBe("/api/auth/reset-password");
    expect(maskSecretsInUrl("/api/categories?x=1")).toBe("/api/categories?x=1");
    expect(maskSecretsInUrl(undefined)).toBeUndefined();
  });
});
