/**
 * Espelha exatamente src/auth/permissions.js e dev/session-fixtures.js do
 * frontend aprovado (sumi-prototipo) — não são um novo modelo de permissões,
 * são a mesma lista de strings e a mesma composição de concessões por
 * perfil que já estava demonstrada nas sessões de desenvolvimento.
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

export const TODAS_PERMISSOES_ADMIN = Object.freeze(Object.values(PERMISSOES));

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
