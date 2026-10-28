import type { Request, Response } from "express";

export function lerCookie(req: Request, nome: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const parte of header.split(";")) {
    const separador = parte.indexOf("=");
    if (separador === -1) continue;
    const chave = parte.slice(0, separador).trim();
    if (chave === nome) return decodeURIComponent(parte.slice(separador + 1).trim());
  }
  return null;
}

/**
 * Acrescenta (em vez de sobrescrever) o Set-Cookie — o callback do GOV.BR
 * grava a sessão e apaga o cookie temporário do fluxo na mesma resposta.
 */
export function definirCookie(res: Response, nome: string, valor: string, maxIdadeSegundos: number, caminho = "/"): void {
  res.append(
    "Set-Cookie",
    `${nome}=${encodeURIComponent(valor)}; Path=${caminho}; HttpOnly; SameSite=Lax; Max-Age=${maxIdadeSegundos}${cookieSeguro()}`,
  );
}

export function limparCookie(res: Response, nome: string, caminho = "/"): void {
  res.append("Set-Cookie", `${nome}=; Path=${caminho}; HttpOnly; SameSite=Lax; Max-Age=0${cookieSeguro()}`);
}

export function definirCookieSessao(res: Response, nome: string, valor: string, maxIdadeSegundos: number): void {
  definirCookie(res, nome, valor, maxIdadeSegundos);
}

export function limparCookieSessao(res: Response, nome: string): void {
  limparCookie(res, nome);
}

function cookieSeguro(): string {
  return process.env.NODE_ENV === "production" && process.env.SESSION_COOKIE_SECURE !== "false" ? "; Secure" : "";
}
