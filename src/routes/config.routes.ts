import { Router } from "express";
import { googleEnabled } from "../lib/auth";

export const configRoutes = Router();

/** O que a tela precisa saber antes do login, como mostrar ou não o botão do Google. */
configRoutes.get("/config", (_request, response) => {
  response.json({ googleLogin: googleEnabled });
});
