import { Router } from "express";
import { definirCookieSessao, lerCookie, limparCookieSessao } from "../../lib/cookies.js";
import { authService, DURACAO_SESSAO_MS, NOME_COOKIE_SESSAO } from "./auth.service.js";
import { loginSchema, parseOrLancar } from "./auth.schema.js";

export const authRouter = Router();

authRouter.post("/api/v1/auth/login", async (req, res, next) => {
  try {
    const input = parseOrLancar(loginSchema, req.body);
    const { sessao, token } = await authService.autenticar(input.email, input.senha);
    definirCookieSessao(res, NOME_COOKIE_SESSAO, token, Math.floor(DURACAO_SESSAO_MS / 1000));
    res.json(sessao);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/api/v1/auth/logout", async (req, res, next) => {
  try {
    const token = lerCookie(req, NOME_COOKIE_SESSAO);
    await authService.encerrar(token);
    limparCookieSessao(res, NOME_COOKIE_SESSAO);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/api/v1/auth/session", async (req, res, next) => {
  try {
    const token = lerCookie(req, NOME_COOKIE_SESSAO);
    const sessao = await authService.carregarSessaoPorToken(token);
    if (!sessao) {
      res.status(401).json({ error: "Sessão não encontrada ou expirada" });
      return;
    }
    res.json(sessao);
  } catch (err) {
    next(err);
  }
});
