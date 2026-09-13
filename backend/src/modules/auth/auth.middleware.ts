import type { NextFunction, Request, Response } from "express";
import { lerCookie } from "../../lib/cookies.js";
import { authService, NOME_COOKIE_SESSAO } from "./auth.service.js";
import { montarSessao } from "./auth.service.js";
import type { SessaoUsuario } from "./auth.types.js";

declare global {
  namespace Express {
    interface Request {
      /** Sessão calculada a partir do cookie — sempre presente (cai para "consulta pública" quando não autenticado). */
      sumiSession: SessaoUsuario;
    }
  }
}

const sessaoPublica = (): SessaoUsuario => montarSessao(null, []);

/**
 * Resolve a sessão do cookie (se houver) e anexa em `req.sumiSession` para
 * as rotas de `planning` usarem na filtragem/autorização — sem exigir que o
 * front chame GET /auth/session antes de cada requisição.
 */
export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = lerCookie(req, NOME_COOKIE_SESSAO);
    const sessao = await authService.carregarSessaoPorToken(token);
    req.sumiSession = sessao ?? sessaoPublica();
    next();
  } catch (err) {
    next(err);
  }
}
