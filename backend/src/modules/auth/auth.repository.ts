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

  async listar(): Promise<Usuario[]> {
    const { data, error } = await supabase.from("usuario").select("*").order("nome");
    tratarErro(error, "Falha ao listar usuários");
    return (data as UsuarioRow[]).map(paraUsuario);
  },

  /** Usado para notificações por e-mail (ex.: responsáveis de um eixo) — devolve só os usuários existentes dentre os ids. */
  async listarPorIds(ids: string[]): Promise<Usuario[]> {
    if (!ids.length) return [];
    const { data, error } = await supabase.from("usuario").select("*").in("id", ids);
    tratarErro(error, "Falha ao buscar usuários");
    return (data as UsuarioRow[]).map(paraUsuario);
  },

  async criar(input: { nome: string; email: string; senhaHash: string; papelAdmin: boolean }): Promise<Usuario> {
    const { data, error } = await supabase
      .from("usuario")
      .insert({ nome: input.nome, email: input.email.trim().toLowerCase(), senha_hash: input.senhaHash, papel_admin: input.papelAdmin })
      .select("*")
      .single();
    tratarErro(error, "Falha ao criar usuário");
    return paraUsuario(data as UsuarioRow);
  },

  async atualizar(id: string, input: { nome?: string; papelAdmin?: boolean; senhaHash?: string }): Promise<Usuario | null> {
    const dados: Record<string, unknown> = {};
    if (input.nome !== undefined) dados.nome = input.nome;
    if (input.papelAdmin !== undefined) dados.papel_admin = input.papelAdmin;
    if (input.senhaHash !== undefined) dados.senha_hash = input.senhaHash;
    const { data, error } = await supabase.from("usuario").update(dados).eq("id", id).select("*").maybeSingle();
    tratarErro(error, "Falha ao atualizar usuário");
    return data ? paraUsuario(data as UsuarioRow) : null;
  },

  async remover(id: string): Promise<void> {
    const { error } = await supabase.from("usuario").delete().eq("id", id);
    tratarErro(error, "Falha ao remover usuário");
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

export const redefinicaoSenhaRepository = {
  async criar(input: { usuarioId: string; expiraEm: Date }): Promise<string> {
    const { data, error } = await supabase
      .from("redefinicao_senha")
      .insert({ usuario_id: input.usuarioId, expira_em: input.expiraEm.toISOString() })
      .select("token")
      .single();
    tratarErro(error, "Falha ao criar token de redefinição de senha");
    return (data as { token: string }).token;
  },

  /** null se o token não existe, já foi usado ou expirou. */
  async buscarValido(token: string): Promise<{ usuarioId: string } | null> {
    const { data, error } = await supabase
      .from("redefinicao_senha")
      .select("usuario_id, expira_em, usado_em")
      .eq("token", token)
      .maybeSingle();
    tratarErro(error, "Falha ao carregar token de redefinição de senha");
    if (!data) return null;
    const row = data as { usuario_id: string; expira_em: string; usado_em: string | null };
    if (row.usado_em || new Date(row.expira_em).getTime() <= Date.now()) return null;
    return { usuarioId: row.usuario_id };
  },

  async marcarUsado(token: string): Promise<void> {
    const { error } = await supabase.from("redefinicao_senha").update({ usado_em: new Date().toISOString() }).eq("token", token);
    tratarErro(error, "Falha ao marcar token de redefinição de senha como usado");
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
