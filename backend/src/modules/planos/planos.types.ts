export type TipoCampo =
  | "texto"
  | "texto_longo"
  | "numero"
  | "percentual"
  | "data"
  | "booleano"
  | "selecao";

export interface CampoDef {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  /** Obrigatório e não-vazio quando tipo === "selecao". */
  opcoes?: string[];
}

export interface NivelDef {
  /** Índice 0-based da posição do nível dentro da árvore (raiz não conta). */
  ordem: number;
  /** Identificador estável do nível, usado como chave em esquema_campos. */
  chave: string;
  rotulo: string;
  rotuloPlural?: string;
}

/** Mapa nivel.chave -> lista de campos aceitos naquele nível. */
export type EsquemaCampos = Record<string, CampoDef[]>;

export interface TipoPlano {
  id: string;
  nome: string;
  descricao: string | null;
  esquemaNiveis: NivelDef[];
  esquemaCampos: EsquemaCampos;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NoPlano {
  id: string;
  tipoPlanoId: string;
  noPaiId: string | null;
  /** -1 para a raiz (instância do plano); demais valores indexam esquemaNiveis. */
  nivel: number;
  ordem: number;
  dados: Record<string, unknown>;
  criadoEm: string;
  atualizadoEm: string;
}

export interface NoPlanoArvore extends NoPlano {
  profundidade: number;
}
