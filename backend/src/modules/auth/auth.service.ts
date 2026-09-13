import { gerarHashSenha, verificarSenha } from "../../lib/password.js";
import { HttpError } from "../../lib/http-error.js";
import { authenticatedSessionSchema } from "./auth.contract.js";
import { PERMISSOES, PERMISSOES_GESTOR_EIXO, PERMISSOES_RESPONSAVEL_EIXO, TODAS_PERMISSOES_ADMIN } from "./auth.permissions.js";
import { eixoRepository, sessaoRepository, usuarioRepository } from "./auth.repository.js";
import type { Concessao, EixoParaConcessoes, Papel, SessaoUsuario, Usuario } from "./auth.types.js";

export const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000; // 12h
export const NOME_COOKIE_SESSAO = "sumi_session";

function idsDaLista(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Monta a sessão (papéis + concessões) exatamente como dev/session-fixtures.js
 * fazia no protótipo — só que a partir de dados reais: papel_admin do
 * usuário e a presença do seu id em managerIds/reviewerIds de cada eixo.
 *
 * O corpo de uma sessão autenticada é validado contra
 * `authenticatedSessionSchema` (contrato da PR #6, `auth.contract.ts`) antes
 * de ser devolvido — ver `autenticar`/`carregarSessaoPorToken` abaixo.
 */
export function montarSessao(usuario: Usuario | null, eixos: EixoParaConcessoes[]): SessaoUsuario {
  const concessoes: Concessao[] = [{ permission: PERMISSOES.VIEW_PUBLISHED_PLAN, scope: { type: "global" } }];
  if (!usuario) {
    return { authenticated: false, user: null, roles: [], grants: concessoes };
  }

  const papeis: Papel[] = [];

  if (usuario.papelAdmin) {
    papeis.push({ code: "STRATEGIC_ADMIN", name: "Administrador Estratégico" });
    for (const permissao of TODAS_PERMISSOES_ADMIN) {
      concessoes.push({ permission: permissao, scope: { type: "global" } });
    }
  }

  const comoGestor = eixos.filter((eixo) => idsDaLista(eixo.dados.managerIds).includes(usuario.id));
  const comoResponsavel = eixos.filter((eixo) => idsDaLista(eixo.dados.reviewerIds).includes(usuario.id));

  if (comoGestor.length > 0) {
    papeis.push({ code: "AXIS_CONTRIBUTOR", name: "Gestor do Eixo" });
    concessoes.push({ permission: PERMISSOES.VIEW_WORK_QUEUE, scope: { type: "global" } });
  }
  if (comoResponsavel.length > 0) {
    papeis.push({ code: "AXIS_REVIEWER", name: "Responsável pelo Eixo" });
    concessoes.push({ permission: PERMISSOES.VIEW_REVIEW_QUEUE, scope: { type: "global" } });
  }

  for (const eixo of comoGestor) {
    if (!eixo.noPaiId) continue;
    for (const permissao of PERMISSOES_GESTOR_EIXO) {
      concessoes.push({ permission: permissao, scope: { type: "axis", planId: eixo.noPaiId, axisId: eixo.id } });
    }
  }
  for (const eixo of comoResponsavel) {
    if (!eixo.noPaiId) continue;
    for (const permissao of PERMISSOES_RESPONSAVEL_EIXO) {
      concessoes.push({ permission: permissao, scope: { type: "axis", planId: eixo.noPaiId, axisId: eixo.id } });
    }
  }

  return {
    authenticated: true,
    user: { id: usuario.id, name: usuario.nome, email: usuario.email },
    roles: papeis,
    grants: concessoes,
  };
}

export const authService = {
  async autenticar(email: string, senha: string): Promise<{ sessao: SessaoUsuario; token: string }> {
    const usuario = await usuarioRepository.buscarPorEmail(email);
    if (!usuario || !verificarSenha(senha, usuario.senhaHash)) {
      throw new HttpError(401, "Credenciais inválidas");
    }
    const token = await sessaoRepository.criar({ usuarioId: usuario.id, expiraEm: new Date(Date.now() + DURACAO_SESSAO_MS) });
    const eixos = await eixoRepository.listarTodos();
    const sessao = montarSessao(usuario, eixos);
    authenticatedSessionSchema.parse(sessao);
    return { sessao, token };
  },

  async encerrar(token: string | null): Promise<void> {
    if (token) await sessaoRepository.remover(token);
  },

  async carregarSessaoPorToken(token: string | null): Promise<SessaoUsuario | null> {
    if (!token) return null;
    const usuarioId = await sessaoRepository.buscarUsuarioIdValido(token);
    if (!usuarioId) return null;
    const usuario = await usuarioRepository.buscarPorId(usuarioId);
    if (!usuario) return null;
    const eixos = await eixoRepository.listarTodos();
    const sessao = montarSessao(usuario, eixos);
    authenticatedSessionSchema.parse(sessao);
    return sessao;
  },

  /** Usado pelo seed e por uma futura administração de usuários. */
  gerarHash: gerarHashSenha,
};
