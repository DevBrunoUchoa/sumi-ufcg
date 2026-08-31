import { supabase } from "../../lib/supabase.js";
import { HttpError } from "../../lib/http-error.js";
import type { EsquemaCampos, NivelDef, NoPlano, NoPlanoArvore, TipoPlano } from "./planos.types.js";

const TABELA_TIPO_PLANO = "tipo_plano";
const TABELA_NO_PLANO = "no_plano";

interface TipoPlanoRow {
  id: string;
  nome: string;
  descricao: string | null;
  esquema_niveis: NivelDef[];
  esquema_campos: EsquemaCampos;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

interface NoPlanoRow {
  id: string;
  tipo_plano_id: string;
  no_pai_id: string | null;
  nivel: number;
  ordem: number;
  dados: Record<string, unknown>;
  criado_em: string;
  atualizado_em: string;
}

type NoPlanoArvoreRow = NoPlanoRow & { profundidade: number };

function paraTipoPlano(row: TipoPlanoRow): TipoPlano {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    esquemaNiveis: row.esquema_niveis,
    esquemaCampos: row.esquema_campos,
    ativo: row.ativo,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function paraNoPlano(row: NoPlanoRow): NoPlano {
  return {
    id: row.id,
    tipoPlanoId: row.tipo_plano_id,
    noPaiId: row.no_pai_id,
    nivel: row.nivel,
    ordem: row.ordem,
    dados: row.dados,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function tratarErro(erro: { message: string; code?: string } | null, contexto: string): void {
  if (!erro) return;
  // 23505 = unique_violation, 23503 = foreign_key_violation, 23514 = check_violation
  if (["23505", "23503", "23514"].includes(erro.code ?? "")) {
    throw new HttpError(409, `${contexto}: ${erro.message}`);
  }
  throw new HttpError(500, `${contexto}: ${erro.message}`);
}

export const tipoPlanoRepository = {
  async listar(opts: { apenasAtivos?: boolean } = {}): Promise<TipoPlano[]> {
    let query = supabase.from(TABELA_TIPO_PLANO).select("*").order("nome");
    if (opts.apenasAtivos) query = query.eq("ativo", true);
    const { data, error } = await query;
    tratarErro(error, "Falha ao listar tipos de plano");
    return (data as TipoPlanoRow[]).map(paraTipoPlano);
  },

  async buscarPorId(id: string): Promise<TipoPlano | null> {
    const { data, error } = await supabase.from(TABELA_TIPO_PLANO).select("*").eq("id", id).maybeSingle();
    tratarErro(error, "Falha ao buscar tipo de plano");
    return data ? paraTipoPlano(data as TipoPlanoRow) : null;
  },

  async criar(input: {
    nome: string;
    descricao?: string;
    esquemaNiveis: NivelDef[];
    esquemaCampos: EsquemaCampos;
  }): Promise<TipoPlano> {
    const { data, error } = await supabase
      .from(TABELA_TIPO_PLANO)
      .insert({
        nome: input.nome,
        descricao: input.descricao ?? null,
        esquema_niveis: input.esquemaNiveis,
        esquema_campos: input.esquemaCampos,
      })
      .select("*")
      .single();
    tratarErro(error, "Falha ao criar tipo de plano");
    return paraTipoPlano(data as TipoPlanoRow);
  },

  async atualizar(
    id: string,
    input: { nome?: string; descricao?: string | null; ativo?: boolean },
  ): Promise<TipoPlano | null> {
    const { data, error } = await supabase
      .from(TABELA_TIPO_PLANO)
      .update(input)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    tratarErro(error, "Falha ao atualizar tipo de plano");
    return data ? paraTipoPlano(data as TipoPlanoRow) : null;
  },
};

export const noPlanoRepository = {
  async buscarPorId(id: string): Promise<NoPlano | null> {
    const { data, error } = await supabase.from(TABELA_NO_PLANO).select("*").eq("id", id).maybeSingle();
    tratarErro(error, "Falha ao buscar nó do plano");
    return data ? paraNoPlano(data as NoPlanoRow) : null;
  },

  async listarFilhos(noPaiId: string | null): Promise<NoPlano[]> {
    let query = supabase.from(TABELA_NO_PLANO).select("*").order("ordem");
    query = noPaiId === null ? query.is("no_pai_id", null) : query.eq("no_pai_id", noPaiId);
    const { data, error } = await query;
    tratarErro(error, "Falha ao listar nós filhos");
    return (data as NoPlanoRow[]).map(paraNoPlano);
  },

  async contarFilhos(input: { noPaiId: string | null; tipoPlanoId: string }): Promise<number> {
    let query = supabase
      .from(TABELA_NO_PLANO)
      .select("id", { count: "exact", head: true })
      .eq("tipo_plano_id", input.tipoPlanoId);
    query = input.noPaiId === null ? query.is("no_pai_id", null) : query.eq("no_pai_id", input.noPaiId);
    const { count, error } = await query;
    tratarErro(error, "Falha ao contar nós filhos");
    return count ?? 0;
  },

  async criar(input: {
    tipoPlanoId: string;
    noPaiId: string | null;
    nivel: number;
    ordem: number;
    dados: Record<string, unknown>;
  }): Promise<NoPlano> {
    const { data, error } = await supabase
      .from(TABELA_NO_PLANO)
      .insert({
        tipo_plano_id: input.tipoPlanoId,
        no_pai_id: input.noPaiId,
        nivel: input.nivel,
        ordem: input.ordem,
        dados: input.dados,
      })
      .select("*")
      .single();
    tratarErro(error, "Falha ao criar nó do plano");
    return paraNoPlano(data as NoPlanoRow);
  },

  async atualizarDados(id: string, dados: Record<string, unknown>): Promise<NoPlano | null> {
    const { data, error } = await supabase
      .from(TABELA_NO_PLANO)
      .update({ dados })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    tratarErro(error, "Falha ao atualizar nó do plano");
    return data ? paraNoPlano(data as NoPlanoRow) : null;
  },

  async mover(id: string, input: { noPaiId: string | null; ordem: number }): Promise<NoPlano | null> {
    const { data, error } = await supabase
      .from(TABELA_NO_PLANO)
      .update({ no_pai_id: input.noPaiId, ordem: input.ordem })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    tratarErro(error, "Falha ao reordenar/mover nó do plano");
    return data ? paraNoPlano(data as NoPlanoRow) : null;
  },

  async remover(id: string): Promise<void> {
    const { error } = await supabase.from(TABELA_NO_PLANO).delete().eq("id", id);
    tratarErro(error, "Falha ao remover nó do plano");
  },

  /** Subárvore completa (incluindo a raiz) via RPC `arvore_no_plano` (ver supabase/migrations). */
  async arvore(raizId: string): Promise<NoPlanoArvore[]> {
    const { data, error } = await supabase.rpc("arvore_no_plano", { raiz_id: raizId });
    tratarErro(error, "Falha ao carregar árvore do plano");
    return (data as NoPlanoArvoreRow[]).map((row) => ({ ...paraNoPlano(row), profundidade: row.profundidade }));
  },
};
