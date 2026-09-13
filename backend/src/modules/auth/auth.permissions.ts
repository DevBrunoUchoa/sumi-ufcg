import { PERMISSION_CODES } from "./auth.contract.js";

/**
 * Composição de concessões por perfil — mesma que dev/session-fixtures.js do
 * frontend aprovado (sumi-prototipo) demonstrava. O vocabulário de códigos
 * em si (o que cada string significa e quais existem) é o contrato definido
 * em auth.contract.ts (PR #6), não redefinido aqui.
 */

export const PERMISSOES = Object.freeze({
  VIEW_PUBLISHED_PLAN: "plan.read_published",
  VIEW_INTERNAL_PLAN: "plan.read_internal",
  MANAGE_PLAN: "plan.manage",
  MANAGE_MODEL: "model.manage",
  EDIT_ITEM: "item.edit",
  MANAGE_ACTION: "action.manage",
  UPDATE_STAGE: "stage.update",
  EDIT_TARGET: "indicator.edit_target",
  RECORD_RESULT: "result.create",
  VIEW_RISK: "risk.read",
  MANAGE_RISK: "risk.manage",
  VIEW_HISTORY: "history.read",
  COMMENT_HISTORY: "history.comment",
  SUBMIT_ITEM: "item.submit",
  REVIEW_ITEM: "item.review",
  VIEW_WORK_QUEUE: "work_queue.read",
  VIEW_REVIEW_QUEUE: "review_queue.read",
} as const);

/** O administrador recebe, em escopo global, todo o vocabulário do contrato. */
export const TODAS_PERMISSOES_ADMIN = PERMISSION_CODES;

/** Concedidas por eixo a quem está em `managerIds` (Gestor do Eixo). */
export const PERMISSOES_GESTOR_EIXO = Object.freeze([
  PERMISSOES.VIEW_INTERNAL_PLAN,
  PERMISSOES.UPDATE_STAGE,
  PERMISSOES.RECORD_RESULT,
  PERMISSOES.VIEW_RISK,
  PERMISSOES.VIEW_HISTORY,
  PERMISSOES.COMMENT_HISTORY,
  PERMISSOES.SUBMIT_ITEM,
]);

/** Concedidas por eixo a quem está em `reviewerIds` (Responsável pelo Eixo). */
export const PERMISSOES_RESPONSAVEL_EIXO = Object.freeze([
  PERMISSOES.VIEW_INTERNAL_PLAN,
  PERMISSOES.VIEW_RISK,
  PERMISSOES.VIEW_HISTORY,
  PERMISSOES.COMMENT_HISTORY,
  PERMISSOES.REVIEW_ITEM,
]);
