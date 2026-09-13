import { Router } from "express";
import { definirCookieSessao, lerCookie, limparCookieSessao } from "../../lib/cookies.js";
import { AUTH_SESSION_PATH, type UnauthenticatedSessionError } from "./auth.contract.js";
import { authService, DURACAO_SESSAO_MS, NOME_COOKIE_SESSAO } from "./auth.service.js";
import { loginSchema, parseOrLancar } from "./auth.schema.js";

export const authRouter = Router();

const SESSAO_AUSENTE: UnauthenticatedSessionError = {
  error: { code: "UNAUTHENTICATED", message: "Sessão institucional ausente ou expirada." },
};

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

authRouter.get(AUTH_SESSION_PATH, async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const token = lerCookie(req, NOME_COOKIE_SESSAO);
    const sessao = await authService.carregarSessaoPorToken(token);
    if (!sessao) {
      res.status(401).json(SESSAO_AUSENTE);
      return;
    }
    res.json(sessao);
  } catch (err) {
    next(err);
  }
});
