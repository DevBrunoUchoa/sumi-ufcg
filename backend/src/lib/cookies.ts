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

export function definirCookieSessao(res: Response, nome: string, valor: string, maxIdadeSegundos: number): void {
  const seguro = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${nome}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxIdadeSegundos}${seguro}`,
  );
}

export function limparCookieSessao(res: Response, nome: string): void {
  const seguro = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${nome}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${seguro}`);
}
