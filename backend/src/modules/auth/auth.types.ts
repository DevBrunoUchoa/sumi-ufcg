export type TipoEscopo = "global" | "plan" | "axis" | "item";

export interface Escopo {
  type: TipoEscopo;
  planId?: string;
  axisId?: string;
  itemId?: string;
}

export interface Concessao {
  permission: string;
  scope: Escopo;
}

export interface Papel {
  code: string;
  name: string;
}

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
  criadoEm: string;
  atualizadoEm: string;
}

/** Recorte mínimo de um nó nivel=0 (eixo) usado para calcular concessões. */
export interface EixoParaConcessoes {
  id: string;
  noPaiId: string | null;
  dados: { managerIds?: unknown; reviewerIds?: unknown };
}
