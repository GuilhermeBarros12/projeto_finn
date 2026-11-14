import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { ClientDisconnectedError, createStreamWriter } from "../src/lib/stream-writer";

const listen = async (handler: http.RequestListener) => {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return { server, url: `http://localhost:${(server.address() as AddressInfo).port}/` };
};

describe("escrita da exportação (EXPORT-02)", () => {
  it("para de escrever quando o cliente desconecta no meio", async () => {
    let outcome: Promise<unknown> = Promise.resolve("sem requisição");
    let writes = 0;
    const { server, url } = await listen((_request, response) => {
      const write = createStreamWriter(response);
      outcome = (async () => {
        for (let index = 0; index < 100_000; index += 1) {
          await write("x".repeat(64 * 1024));
          writes += 1;
        }
        return "terminou";
      })().catch((error: unknown) => error);
    });

    await new Promise<void>((resolve) => {
      const client = http.get(url, (response) => {
        response.once("data", () => {
          response.pause();
          setTimeout(() => {
            client.destroy();
            resolve();
          }, 200);
        });
      });
      client.on("error", () => undefined);
    });

    const result = await Promise.race([
      outcome,
      new Promise((resolve) => setTimeout(() => resolve("pendente"), 3000)),
    ]);
    server.close();

    expect(result).toBeInstanceOf(ClientDisconnectedError);
    expect(writes).toBeLessThan(1000);
  });

  it("entrega tudo quando o cliente lê até o fim", async () => {
    const { server, url } = await listen(async (_request, response) => {
      const write = createStreamWriter(response);
      for (const part of ["a", "b", "c"]) await write(part);
      response.end();
    });

    const body = await new Promise<string>((resolve) => {
      http.get(url, (response) => {
        let text = "";
        response.on("data", (chunk) => (text += chunk));
        response.on("end", () => resolve(text));
      });
    });
    server.close();

    expect(body).toBe("abc");
  });
});
