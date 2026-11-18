import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { AuthPage } from "./AuthPage";

vi.mock("../api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

const apiError = (status: number, data: object) =>
  new AxiosError("falha", "ERR", undefined, undefined, {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as never,
  });

beforeEach(() => {
  vi.mocked(api.get)
    .mockReset()
    .mockResolvedValue({ data: { googleLogin: false } });
  vi.mocked(api.post).mockReset().mockResolvedValue({ data: {} });
});

describe("login e cadastro", () => {
  it("entra com e-mail e senha", async () => {
    const onAuthenticated = vi.fn();
    render(<AuthPage onAuthenticated={onAuthenticated} />);

    await userEvent.type(screen.getByLabelText("E-mail"), "ana@finn.test");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-segura-123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(api.post).toHaveBeenCalledWith("/auth/sign-in/email", {
      email: "ana@finn.test",
      password: "senha-segura-123",
    });
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
  });

  it("explica o erro do Better Auth em português", async () => {
    vi.mocked(api.post).mockRejectedValue(
      apiError(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" }),
    );
    render(<AuthPage onAuthenticated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("E-mail"), "ana@finn.test");
    await userEvent.type(screen.getByLabelText("Senha"), "errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
  });

  it("cadastra e já entra, sem pedir o login de novo", async () => {
    const onAuthenticated = vi.fn();
    render(<AuthPage onAuthenticated={onAuthenticated} />);

    await userEvent.click(screen.getByRole("button", { name: "Criar minha conta" }));
    await userEvent.type(screen.getByLabelText("Nome"), "Ana");
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@finn.test");
    await userEvent.type(screen.getByLabelText("Senha"), "senha-segura-123");
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(api.post).toHaveBeenCalledWith("/auth/sign-up/email", {
      name: "Ana",
      email: "ana@finn.test",
      password: "senha-segura-123",
    });
    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
  });
});

describe("esqueci a senha", () => {
  it("pede o link e responde igual, exista a conta ou não", async () => {
    render(<AuthPage onAuthenticated={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Esqueci minha senha" }));
    await userEvent.type(screen.getByLabelText("E-mail"), "alguem@finn.test");
    await userEvent.click(screen.getByRole("button", { name: "Enviar link" }));

    expect(api.post).toHaveBeenCalledWith("/auth/request-password-reset", {
      email: "alguem@finn.test",
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Se existir uma conta");
  });

  it("troca a senha com o token do link e volta ao login avisando", async () => {
    render(<AuthPage resetToken="token-do-email" onAuthenticated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Senha nova"), "senha-nova-456");
    await userEvent.click(screen.getByRole("button", { name: "Salvar senha" }));

    expect(api.post).toHaveBeenCalledWith("/auth/reset-password", {
      token: "token-do-email",
      newPassword: "senha-nova-456",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Senha alterada");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("avisa quando o link já foi usado ou venceu", async () => {
    vi.mocked(api.post).mockRejectedValue(apiError(400, { code: "INVALID_TOKEN" }));
    render(<AuthPage resetToken="velho" onAuthenticated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Senha nova"), "senha-nova-456");
    await userEvent.click(screen.getByRole("button", { name: "Salvar senha" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("expirou ou já foi usado");
  });
});

describe("login com Google", () => {
  it("só mostra o botão quando o servidor tem as credenciais", async () => {
    const { unmount } = render(<AuthPage onAuthenticated={vi.fn()} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/config"));
    expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
    unmount();

    vi.mocked(api.get).mockResolvedValue({ data: { googleLogin: true } });
    render(<AuthPage onAuthenticated={vi.fn()} />);

    expect(await screen.findByRole("button", { name: /Google/ })).toBeInTheDocument();
  });
});
