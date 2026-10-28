import { gerarHashSenha, verificarSenha } from "../../lib/password.js";
import { cpfValido, normalizarCpf } from "../../lib/cpf.js";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { mailer } from "../../lib/mailer.js";
import { authenticatedSessionSchema, type PermissionCode } from "./auth.contract.js";
import { PERMISSOES_CONCEDIVEIS_POR_EIXO, PERMISSOES, PERMISSOES_GESTOR_EIXO, PERMISSOES_RESPONSAVEL_EIXO, TODAS_PERMISSOES_ADMIN } from "./auth.permissions.js";
import { eixoRepository, redefinicaoSenhaRepository, sessaoRepository, usuarioRepository } from "./auth.repository.js";
import type { Concessao, EixoParaConcessoes, Papel, SessaoUsuario, Usuario } from "./auth.types.js";
import type { IdentidadeGovbr } from "./govbr.js";

export const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000; // 12h
export const DURACAO_REDEFINICAO_SENHA_MS = 60 * 60 * 1000; // 1h
export const NOME_COOKIE_SESSAO = "sumi_session";

function idsDaLista(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string") : [];
}

const PERMISSOES_CONCEDIVEIS_POR_EIXO_SET = new Set<PermissionCode>(PERMISSOES_CONCEDIVEIS_POR_EIXO);

/**
 * Extrai, de `axis.customGrants` (array `{ userId, permissions }[]`), as
 * permissões concedidas avulsamente a um usuário específico naquele eixo —
 * filtradas contra o vocabulário concedível por eixo (defesa em profundidade:
 * o schema do PUT do workspace já impede gravar código fora dessa lista,
 * mas uma gravação antiga ou direta no banco não passa por ele).
 */
function permissoesCustomizadas(valor: unknown, usuarioId: string): PermissionCode[] {
  if (!Array.isArray(valor)) return [];
  const entrada = valor.find(
    (item): item is { userId: string; permissions?: unknown } =>
      Boolean(item) && typeof item === "object" && (item as { userId?: unknown }).userId === usuarioId,
  );
  if (!entrada || !Array.isArray(entrada.permissions)) return [];
  return entrada.permissions.filter((permissao): permissao is PermissionCode =>
    typeof permissao === "string" && PERMISSOES_CONCEDIVEIS_POR_EIXO_SET.has(permissao as PermissionCode),
  );
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
    papeis.push({ code: "AXIS_CONTRIBUTOR", name: "Responsável Técnico do Eixo" });
    concessoes.push({ permission: PERMISSOES.VIEW_WORK_QUEUE, scope: { type: "global" } });
  }
  if (comoResponsavel.length > 0) {
    papeis.push({ code: "AXIS_REVIEWER", name: "Gestor do Eixo" });
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

  // Permissões avulsas por eixo (tela de Estrutura → "Permissões
  // específicas"), independentes de ser Gestor/Responsável — cada usuário
  // marca só o que precisa, em qualquer eixo, sem virar dono do eixo inteiro.
  for (const eixo of eixos) {
    if (!eixo.noPaiId) continue;
    for (const permissao of permissoesCustomizadas(eixo.dados.customGrants, usuario.id)) {
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

async function criarSessao(usuario: Usuario): Promise<{ sessao: SessaoUsuario; token: string }> {
  const token = await sessaoRepository.criar({ usuarioId: usuario.id, expiraEm: new Date(Date.now() + DURACAO_SESSAO_MS) });
  const eixos = await eixoRepository.listarTodos();
  const sessao = montarSessao(usuario, eixos);
  authenticatedSessionSchema.parse(sessao);
  return { sessao, token };
}

export const authService = {
  async autenticar(email: string, senha: string): Promise<{ sessao: SessaoUsuario; token: string }> {
    const usuario = await usuarioRepository.buscarPorEmail(email);
    if (!usuario || !verificarSenha(senha, usuario.senhaHash)) {
      throw new HttpError(401, "Credenciais inválidas");
    }
    return criarSessao(usuario);
  },

  /**
   * Liga a identidade GOV.BR a um usuário do SUMI: primeiro pelo CPF
   * cadastrado; sem CPF, pelo e-mail verificado no GOV.BR — e aí grava o CPF,
   * para os próximos logins. Quem não tem conta no SUMI (ou cujo e-mail já
   * está ligado a outro CPF) não entra: contas e permissões vêm do admin.
   */
  async autenticarGovbr(identidade: IdentidadeGovbr): Promise<{ sessao: SessaoUsuario; token: string }> {
    const cpf = normalizarCpf(identidade.cpf);
    if (!cpfValido(cpf)) throw new HttpError(400, "CPF inválido na resposta do GOV.BR");
    let usuario = await usuarioRepository.buscarPorCpf(cpf);
    if (!usuario && identidade.emailVerificado && identidade.email) {
      const porEmail = await usuarioRepository.buscarPorEmail(identidade.email);
      if (porEmail && !porEmail.cpf) {
        usuario = await usuarioRepository.atualizar(porEmail.id, { cpf });
        logger.info({ usuarioId: porEmail.id }, "Conta ligada ao GOV.BR pelo e-mail no primeiro acesso");
      }
    }
    if (!usuario) throw new HttpError(403, "Conta GOV.BR sem usuário no SUMI");
    return criarSessao(usuario);
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

  /**
   * Não revela se o e-mail existe ou não: a resposta HTTP é sempre a mesma
   * (204) tanto no login.service.ts como no front, pra não virar uma forma
   * de enumerar e-mails cadastrados. Só dispara o e-mail quando o usuário
   * existe de fato.
   */
  async solicitarRedefinicaoSenha(email: string): Promise<void> {
    const usuario = await usuarioRepository.buscarPorEmail(email);
    if (!usuario) return;
    const token = await redefinicaoSenhaRepository.criar({ usuarioId: usuario.id, expiraEm: new Date(Date.now() + DURACAO_REDEFINICAO_SENHA_MS) });
    const link = `${env.FRONTEND_URL}/#/redefinir-senha?token=${token}`;
    await mailer
      .enviar({
        to: usuario.email,
        subject: "Redefinição de senha — SUMI",
        html: `<p>Olá, ${usuario.nome}.</p><p>Recebemos um pedido para redefinir a senha da sua conta no SUMI. Clique no link abaixo para criar uma nova senha — ele expira em 1 hora.</p><p><a href="${link}">${link}</a></p><p>Se você não pediu essa redefinição, pode ignorar este e-mail.</p>`,
        text: `Redefinição de senha do SUMI.\n\nAcesse para criar uma nova senha (expira em 1 hora): ${link}\n\nSe você não pediu essa redefinição, ignore este e-mail.`,
      })
      .catch((err) => logger.error({ err, usuarioId: usuario.id }, "Falha ao enviar e-mail de redefinição de senha"));
  },

  async redefinirSenha(token: string, novaSenha: string): Promise<void> {
    const resultado = await redefinicaoSenhaRepository.buscarValido(token);
    if (!resultado) throw new HttpError(400, "Link de redefinição inválido ou expirado — solicite um novo.");
    await usuarioRepository.atualizar(resultado.usuarioId, { senhaHash: gerarHashSenha(novaSenha) });
    await redefinicaoSenhaRepository.marcarUsado(token);
  },

  /** Usado pelo seed e por uma futura administração de usuários. */
  gerarHash: gerarHashSenha,
};
