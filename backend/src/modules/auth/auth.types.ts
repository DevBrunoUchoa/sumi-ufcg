import type { PermissionGrant, PermissionScope, SessionRole } from "./auth.contract.js";

export type Escopo = PermissionScope;
export type Concessao = PermissionGrant;
export type Papel = SessionRole;

export interface SessaoUsuario {
  authenticated: boolean;
  user: { id: string; name: string; email: string | null } | null;
  roles: Papel[];
  grants: Concessao[];
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  papelAdmin: boolean;
  /** Só dígitos; liga a conta ao login com GOV.BR (ver authService.autenticarGovbr). */
  cpf: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/** Recorte mínimo de um nó nivel=0 (eixo) usado para calcular concessões. */
export interface EixoParaConcessoes {
  id: string;
  noPaiId: string | null;
  dados: { managerIds?: unknown; reviewerIds?: unknown; customGrants?: unknown };
}
