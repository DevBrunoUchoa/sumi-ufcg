import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hash de senha com scrypt (node:crypto) — sem dependência externa.
 * Formato armazenado: "<salt hex>:<hash hex>".
 */
const TAMANHO_CHAVE = 64;

export function gerarHashSenha(senha: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(senha, sal, TAMANHO_CHAVE);
  return `${sal.toString("hex")}:${hash.toString("hex")}`;
}

export function verificarSenha(senha: string, hashArmazenado: string): boolean {
  const [salHex, hashHex] = hashArmazenado.split(":");
  if (!salHex || !hashHex) return false;
  const sal = Buffer.from(salHex, "hex");
  const hashEsperado = Buffer.from(hashHex, "hex");
  const hashCalculado = scryptSync(senha, sal, hashEsperado.length);
  return hashCalculado.length === hashEsperado.length && timingSafeEqual(hashCalculado, hashEsperado);
}
