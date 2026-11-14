import type { ServerResponse } from "node:http";

export class ClientDisconnectedError extends Error {
  constructor() {
    super("O cliente encerrou a conexão.");
    this.name = "ClientDisconnectedError";
  }
}

/**
 * Escreve respeitando o backpressure. Se o cliente desconecta, o evento "drain" nunca chega:
 * sem também ouvir "close", a requisição ficaria pendente para sempre.
 */
export const createStreamWriter = (response: ServerResponse) => {
  let closed = false;
  response.once("close", () => {
    closed = true;
  });

  const waitForDrainOrClose = () =>
    new Promise<void>((resolve) => {
      const done = () => {
        response.off("drain", done);
        response.off("close", done);
        resolve();
      };
      response.on("drain", done);
      response.on("close", done);
    });

  return async (chunk: string): Promise<void> => {
    if (closed) throw new ClientDisconnectedError();
    if (!response.write(chunk) && !closed) await waitForDrainOrClose();
    if (closed) throw new ClientDisconnectedError();
  };
};
