import { Router, type Response } from "express";
import { env } from "../../config/env.js";
import { definirCookie, definirCookieSessao, lerCookie, limparCookie } from "../../lib/cookies.js";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/logger.js";
import { authService, DURACAO_SESSAO_MS, NOME_COOKIE_SESSAO } from "./auth.service.js";
import { concluirFluxoGovbr, GOVBR_CALLBACK_PATH, govbrHabilitado, iniciarFluxoGovbr, type FluxoGovbr } from "./govbr.js";

export const govbrRouter = Router();

// Estado, nonce e verificador PKCE entre a ida ao GOV.BR e o callback.
// httpOnly e restrito às rotas do GOV.BR; SameSite=Lax deixa o cookie voltar
// no redirecionamento do GOV.BR para o callback (navegação GET de topo).
const COOKIE_FLUXO = "sumi_govbr";
const CAMINHO_COOKIE_FLUXO = "/api/v1/auth/govbr";
const DURACAO_FLUXO_S = 10 * 60;

type FalhaGovbr = "cancelado" | "nao-vinculado" | "falha";

/** Só caminhos internos do frontend (hash router); o resto volta para /inicio. */
function retornoSeguro(valor: unknown): string {
  return typeof valor === "string" && valor.length <= 500 && /^\/(?!\/)[^\\\s]*$/.test(valor) ? valor : "/inicio";
}

function irParaFrontend(res: Response, caminho: string): void {
  res.redirect(`${env.FRONTEND_URL.replace(/\/$/, "")}/#${caminho}`);
}

function voltarAoLogin(res: Response, falha: FalhaGovbr, retorno: string): void {
  irParaFrontend(res, `/login?${new URLSearchParams({ govbr: falha, returnTo: retorno })}`);
}

function lerFluxo(valor: string | null): FluxoGovbr | null {
  if (!valor) return null;
  try {
    const fluxo = JSON.parse(Buffer.from(valor, "base64url").toString("utf8")) as Partial<FluxoGovbr>;
    if (typeof fluxo.estado !== "string" || typeof fluxo.nonce !== "string" || typeof fluxo.verificador !== "string") return null;
    return { estado: fluxo.estado, nonce: fluxo.nonce, verificador: fluxo.verificador, retorno: retornoSeguro(fluxo.retorno) };
  } catch {
    return null;
  }
}

/** O frontend só mostra o botão "Entrar com gov.br" quando o servidor tem as credenciais. */
govbrRouter.get("/api/v1/auth/govbr", (_req, res) => {
  res.json({ enabled: govbrHabilitado() });
});

govbrRouter.get("/api/v1/auth/govbr/authorize", async (req, res, next) => {
  const retorno = retornoSeguro(req.query.returnTo);
  if (!govbrHabilitado()) {
    next(new HttpError(404, "Login com GOV.BR não configurado"));
    return;
  }
  try {
    const { url, fluxo } = await iniciarFluxoGovbr(retorno);
    definirCookie(res, COOKIE_FLUXO, Buffer.from(JSON.stringify(fluxo)).toString("base64url"), DURACAO_FLUXO_S, CAMINHO_COOKIE_FLUXO);
    res.redirect(url.href);
  } catch (err) {
    logger.error({ err }, "Não foi possível iniciar o login com GOV.BR");
    voltarAoLogin(res, "falha", retorno);
  }
});

govbrRouter.get(GOVBR_CALLBACK_PATH, async (req, res) => {
  const fluxo = lerFluxo(lerCookie(req, COOKIE_FLUXO));
  limparCookie(res, COOKIE_FLUXO, CAMINHO_COOKIE_FLUXO);
  const retorno = fluxo?.retorno ?? "/inicio";

  if (req.query.error) {
    voltarAoLogin(res, req.query.error === "access_denied" ? "cancelado" : "falha", retorno);
    return;
  }
  if (!govbrHabilitado() || !fluxo) {
    // Sem o cookie do fluxo (expirou, ou o callback não veio da nossa ida ao GOV.BR).
    voltarAoLogin(res, "falha", retorno);
    return;
  }

  try {
    const inicioQuery = req.originalUrl.indexOf("?");
    const identidade = await concluirFluxoGovbr(inicioQuery === -1 ? "" : req.originalUrl.slice(inicioQuery), fluxo);
    const { token } = await authService.autenticarGovbr(identidade);
    definirCookieSessao(res, NOME_COOKIE_SESSAO, token, Math.floor(DURACAO_SESSAO_MS / 1000));
    irParaFrontend(res, retorno);
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) {
      voltarAoLogin(res, "nao-vinculado", retorno);
      return;
    }
    logger.warn({ err }, "Falha no login com GOV.BR");
    voltarAoLogin(res, "falha", retorno);
  }
});
