import { supabase } from "../../lib/supabase.js";
import { HttpError } from "../../lib/http-error.js";

function tratarErro(erro: { message: string; code?: string } | null, contexto: string): void {
  if (!erro) return;
  if (["23505", "23503", "23514"].includes(erro.code ?? "")) {
    throw new HttpError(409, `${contexto}: ${erro.message}`);
  }
  throw new HttpError(500, `${contexto}: ${erro.message}`);
}

// ---- tipo_plano (colunas próprias do módulo planning) ---------------------

export interface TipoPlanoRow {
  id: string;
  nome: string;
  descricao: string | null;
  esquema_niveis: unknown;
  esquema_campos: unknown;
  ativo: boolean;
  tipo: string;
  versao: number;
  rotulos: Record<string, string>;
  periodicidade_padrao: string;
  campos_extras: unknown[];
  criado_em: string;
  atualizado_em: string;
}

export const tipoPlanoRepo = {
  async listar(): Promise<TipoPlanoRow[]> {
    const { data, error } = await supabase.from("tipo_plano").select("*").order("nome");
    tratarErro(error, "Falha ao listar modelos");
    return data as TipoPlanoRow[];
  },

  async atualizarMetadados(
    id: string,
    input: { rotulos: Record<string, string>; camposExtras: unknown[]; versao: number },
  ): Promise<void> {
    const { error } = await supabase
      .from("tipo_plano")
      .update({ rotulos: input.rotulos, campos_extras: input.camposExtras, versao: input.versao })
      .eq("id", id);
    tratarErro(error, "Falha ao atualizar modelo");
  },
};

// ---- no_plano (eixo/objetivo/item) -----------------------------------------

export interface NoPlanoRow {
  id: string;
  tipo_plano_id: string;
  no_pai_id: string | null;
  nivel: number;
  ordem: number;
  dados: Record<string, unknown>;
  criado_em: string;
  atualizado_em: string;
}

export const noPlanoRepo = {
  async buscarPorId(id: string): Promise<NoPlanoRow | null> {
    const { data, error } = await supabase.from("no_plano").select("*").eq("id", id).maybeSingle();
    tratarErro(error, "Falha ao buscar nó do plano");
    return data as NoPlanoRow | null;
  },

  /** Todos os nós (raiz + eixos + objetivos + itens) de um tipo_plano — volume pequeno, uma consulta só. */
  async listarPorTipo(tipoPlanoId: string): Promise<NoPlanoRow[]> {
    const { data, error } = await supabase
      .from("no_plano")
      .select("*")
      .eq("tipo_plano_id", tipoPlanoId)
      .order("nivel")
      .order("ordem");
    tratarErro(error, "Falha ao carregar plano");
    return data as NoPlanoRow[];
  },

  async listarTodos(): Promise<NoPlanoRow[]> {
    const { data, error } = await supabase.from("no_plano").select("*").order("nivel").order("ordem");
    tratarErro(error, "Falha ao carregar planos");
    return data as NoPlanoRow[];
  },

  async upsertLote(
    linhas: { id: string; tipoPlanoId: string; noPaiId: string | null; nivel: number; ordem: number; dados: Record<string, unknown> }[],
  ): Promise<void> {
    if (!linhas.length) return;
    const { error } = await supabase.from("no_plano").upsert(
      linhas.map((linha) => ({
        id: linha.id,
        tipo_plano_id: linha.tipoPlanoId,
        no_pai_id: linha.noPaiId,
        nivel: linha.nivel,
        ordem: linha.ordem,
        dados: linha.dados,
      })),
      { onConflict: "id" },
    );
    tratarErro(error, "Falha ao gravar plano");
  },

  async removerLote(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const { error } = await supabase.from("no_plano").delete().in("id", ids);
    tratarErro(error, "Falha ao remover nós do plano");
  },

  async criarRaiz(input: { id: string; tipoPlanoId: string; dados: Record<string, unknown> }): Promise<void> {
    const { error } = await supabase
      .from("no_plano")
      .insert({ id: input.id, tipo_plano_id: input.tipoPlanoId, no_pai_id: null, nivel: -1, ordem: 0, dados: input.dados });
    tratarErro(error, "Falha ao criar plano");
  },
};

// ---- indicador / resultado --------------------------------------------------

export const indicadorRepo = {
  async listarTodos(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.from("indicador").select("*");
    tratarErro(error, "Falha ao carregar indicadores");
    return data as Record<string, unknown>[];
  },
  async upsertLote(linhas: Record<string, unknown>[]): Promise<void> {
    if (!linhas.length) return;
    const { error } = await supabase.from("indicador").upsert(linhas, { onConflict: "no_plano_id" });
    tratarErro(error, "Falha ao gravar indicadores");
  },
  async removerPorItens(idsItem: string[]): Promise<void> {
    if (!idsItem.length) return;
    const { error } = await supabase.from("indicador").delete().in("no_plano_id", idsItem);
    tratarErro(error, "Falha ao remover indicadores");
  },
};

export const resultadoRepo = {
  async listarTodos(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.from("resultado").select("*").order("ano");
    tratarErro(error, "Falha ao carregar resultados");
    return data as Record<string, unknown>[];
  },
  async inserirLote(linhas: Record<string, unknown>[]): Promise<void> {
    if (!linhas.length) return;
    const { error } = await supabase.from("resultado").insert(linhas);
    tratarErro(error, "Falha ao gravar resultados");
  },
  async removerPorItens(idsItem: string[]): Promise<void> {
    if (!idsItem.length) return;
    const { error } = await supabase.from("resultado").delete().in("no_plano_id", idsItem);
    tratarErro(error, "Falha ao remover resultados");
  },
};

// ---- ação / etapa -----------------------------------------------------------

export const acaoRepo = {
  async listarTodos(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.from("acao").select("*").order("ordem");
    tratarErro(error, "Falha ao carregar ações");
    return data as Record<string, unknown>[];
  },
  async inserirLote(linhas: Record<string, unknown>[]): Promise<void> {
    if (!linhas.length) return;
    const { error } = await supabase.from("acao").insert(linhas);
    tratarErro(error, "Falha ao gravar ações");
  },
  async removerPorItens(idsItem: string[]): Promise<void> {
    if (!idsItem.length) return;
    const { error } = await supabase.from("acao").delete().in("no_plano_id", idsItem);
    tratarErro(error, "Falha ao remover ações");
  },
};

export const etapaRepo = {
  async listarTodos(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.from("etapa").select("*").order("ordem");
    tratarErro(error, "Falha ao carregar etapas");
    return data as Record<string, unknown>[];
  },
  async inserirLote(linhas: Record<string, unknown>[]): Promise<void> {
    if (!linhas.length) return;
    const { error } = await supabase.from("etapa").insert(linhas);
    tratarErro(error, "Falha ao gravar etapas");
  },
};

// ---- risco --------------------------------------------------------------------

export const riscoRepo = {
  async listarTodos(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.from("risco").select("*");
    tratarErro(error, "Falha ao carregar riscos");
    return data as Record<string, unknown>[];
  },
  async inserirLote(linhas: Record<string, unknown>[]): Promise<void> {
    if (!linhas.length) return;
    const { error } = await supabase.from("risco").insert(linhas);
    tratarErro(error, "Falha ao gravar riscos");
  },
  async removerPorItens(idsItem: string[]): Promise<void> {
    if (!idsItem.length) return;
    const { error } = await supabase.from("risco").delete().in("no_plano_id", idsItem);
    tratarErro(error, "Falha ao remover riscos");
  },
};

// ---- histórico ------------------------------------------------------------------

export const historicoRepo = {
  async listarTodos(): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase.from("historico").select("*").order("em");
    tratarErro(error, "Falha ao carregar histórico");
    return data as Record<string, unknown>[];
  },
  async inserirLote(linhas: Record<string, unknown>[]): Promise<void> {
    if (!linhas.length) return;
    const { error } = await supabase.from("historico").insert(linhas);
    tratarErro(error, "Falha ao gravar histórico");
  },
  async removerPorItens(idsItem: string[]): Promise<void> {
    if (!idsItem.length) return;
    const { error } = await supabase.from("historico").delete().in("no_plano_id", idsItem);
    tratarErro(error, "Falha ao remover histórico");
  },
};

// ---- anexo ------------------------------------------------------------------

export interface AnexoRow {
  id: string;
  no_plano_id: string;
  etapa_id: string | null;
  resultado_id: string | null;
  nome_arquivo: string;
  tipo_mime: string;
  tamanho_bytes: number;
  caminho_storage: string;
  enviado_por: string;
  enviado_em: string;
}

export const anexoRepo = {
  async listarPorItem(noPlanoId: string): Promise<AnexoRow[]> {
    const { data, error } = await supabase.from("anexo").select("*").eq("no_plano_id", noPlanoId).order("enviado_em");
    tratarErro(error, "Falha ao listar anexos");
    return data as AnexoRow[];
  },
  async buscarPorId(id: string): Promise<AnexoRow | null> {
    const { data, error } = await supabase.from("anexo").select("*").eq("id", id).maybeSingle();
    tratarErro(error, "Falha ao buscar anexo");
    return data as AnexoRow | null;
  },
  async criar(input: {
    noPlanoId: string;
    etapaId: string | null;
    resultadoId: string | null;
    nomeArquivo: string;
    tipoMime: string;
    tamanhoBytes: number;
    caminhoStorage: string;
    enviadoPor: string;
  }): Promise<AnexoRow> {
    const { data, error } = await supabase
      .from("anexo")
      .insert({
        no_plano_id: input.noPlanoId,
        etapa_id: input.etapaId,
        resultado_id: input.resultadoId,
        nome_arquivo: input.nomeArquivo,
        tipo_mime: input.tipoMime,
        tamanho_bytes: input.tamanhoBytes,
        caminho_storage: input.caminhoStorage,
        enviado_por: input.enviadoPor,
      })
      .select("*")
      .single();
    tratarErro(error, "Falha ao registrar anexo");
    return data as AnexoRow;
  },
  async remover(id: string): Promise<void> {
    const { error } = await supabase.from("anexo").delete().eq("id", id);
    tratarErro(error, "Falha ao remover anexo");
  },
  // Reinsere anexos preservando id/metadados — usado para restaurar anexos de
  // etapa/resultado depois que salvarItem apaga e recria essas linhas (o
  // "on delete cascade" da FK já removeu o anexo antes do reinsert acontecer).
  async recriarLote(linhas: AnexoRow[]): Promise<void> {
    if (linhas.length === 0) return;
    const { error } = await supabase.from("anexo").insert(
      linhas.map((linha) => ({
        id: linha.id,
        no_plano_id: linha.no_plano_id,
        etapa_id: linha.etapa_id,
        resultado_id: linha.resultado_id,
        nome_arquivo: linha.nome_arquivo,
        tipo_mime: linha.tipo_mime,
        tamanho_bytes: linha.tamanho_bytes,
        caminho_storage: linha.caminho_storage,
        enviado_por: linha.enviado_por,
        enviado_em: linha.enviado_em,
      })),
    );
    tratarErro(error, "Falha ao restaurar anexos");
  },
};
