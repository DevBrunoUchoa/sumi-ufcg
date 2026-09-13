import type { Escopo, SessaoUsuario } from "./auth.types.js";

/** Espelha scopeContains/can de src/auth/permissions.js no frontend aprovado. */
function escopoContem(escopo: Escopo | undefined, recurso: { planId?: string; axisId?: string; itemId?: string }): boolean {
  if (escopo?.type === "global") return true;
  if (!escopo) return false;
  if (escopo.type === "plan") return Boolean(recurso.planId) && escopo.planId === recurso.planId;
  if (escopo.type === "axis") {
    return Boolean(recurso.planId && recurso.axisId) && escopo.planId === recurso.planId && escopo.axisId === recurso.axisId;
  }
  if (escopo.type === "item") {
    return Boolean(recurso.planId && recurso.itemId) && escopo.planId === recurso.planId && escopo.itemId === recurso.itemId;
  }
  return false;
}

export function pode(
  sessao: SessaoUsuario | null | undefined,
  permissao: string,
  recurso: { planId?: string; axisId?: string; itemId?: string } = {},
): boolean {
  if (!sessao?.grants || !permissao) return false;
  return sessao.grants.some((concessao) => concessao.permission === permissao && escopoContem(concessao.scope, recurso));
}
