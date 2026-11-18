import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Em desenvolvimento a tela também fala com a API pela própria origem, como em produção.
  // Sem isso, o cookie de sessão e os links do e-mail (que apontam para a tela) não funcionariam.
  server: { proxy: { "/api": "http://localhost:3333" } },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    // Fuso fixo: os bugs de data só aparecem fora de UTC.
    env: { TZ: "America/Sao_Paulo" },
  },
});
