import { supabase } from "../../lib/supabase.js";
import { HttpError } from "../../lib/http-error.js";
import type { EixoParaConcessoes, Usuario } from "./auth.types.js";

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  papel_admin: boolean;
  criado_em: string;
  atualizado_em: string;
}

function paraUsuario(row: UsuarioRow): Usuario {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    senhaHash: row.senha_hash,
    papelAdmin: row.papel_admin,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

function tratarErro(erro: { message: string; code?: string } | null, contexto: string): void {
  if (!erro) return;
  if (["23505", "23503", "23514"].includes(erro.code ?? "")) {
    throw new HttpError(409, `${contexto}: ${erro.message}`);
  }
  throw new HttpError(500, `${contexto}: ${erro.message}`);
}

export const usuarioRepository = {
  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from("usuario")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();
    tratarErro(error, "Falha ao buscar usuário");
    return data ? paraUsuario(data as UsuarioRow) : null;
  },

  async buscarPorId(id: string): Promise<Usuario | null> {
    const { data, error } = await supabase.from("usuario").select("*").eq("id", id).maybeSingle();
    tratarErro(error, "Falha ao buscar usuário");
    return data ? paraUsuario(data as UsuarioRow) : null;
  },
};

export const sessaoRepository = {
  async criar(input: { usuarioId: string; expiraEm: Date }): Promise<string> {
    const { data, error } = await supabase
      .from("sessao")
      .insert({ usuario_id: input.usuarioId, expira_em: input.expiraEm.toISOString() })
      .select("token")
      .single();
    tratarErro(error, "Falha ao criar sessão");
    return (data as { token: string }).token;
  },

  async buscarUsuarioIdValido(token: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("sessao")
      .select("usuario_id, expira_em")
      .eq("token", token)
      .maybeSingle();
    tratarErro(error, "Falha ao carregar sessão");
    if (!data) return null;
    const row = data as { usuario_id: string; expira_em: string };
    if (new Date(row.expira_em).getTime() <= Date.now()) {
      await sessaoRepository.remover(token);
      return null;
    }
    return row.usuario_id;
  },

  async remover(token: string): Promise<void> {
    const { error } = await supabase.from("sessao").delete().eq("token", token);
    tratarErro(error, "Falha ao encerrar sessão");
  },
};

export const eixoRepository = {
  /** Todos os nós nivel=0 (eixos) de todos os planos — usado para calcular concessões por managerIds/reviewerIds. */
  async listarTodos(): Promise<EixoParaConcessoes[]> {
    const { data, error } = await supabase.from("no_plano").select("id, no_pai_id, dados").eq("nivel", 0);
    tratarErro(error, "Falha ao carregar eixos");
    return (data as { id: string; no_pai_id: string | null; dados: Record<string, unknown> }[]).map((row) => ({
      id: row.id,
      noPaiId: row.no_pai_id,
      dados: row.dados,
    }));
  },
};
