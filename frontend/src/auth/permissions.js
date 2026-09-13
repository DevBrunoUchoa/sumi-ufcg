export const PERMISSIONS = Object.freeze({
  VIEW_PUBLISHED_PLAN: 'plan.read_published',
  VIEW_INTERNAL_PLAN: 'plan.read_internal',
  MANAGE_PLAN: 'plan.manage',
  MANAGE_MODEL: 'model.manage',
  EDIT_ITEM: 'item.edit',
  MANAGE_ACTION: 'action.manage',
  UPDATE_STAGE: 'stage.update',
  EDIT_TARGET: 'indicator.edit_target',
  RECORD_RESULT: 'result.create',
  VIEW_RISK: 'risk.read',
  MANAGE_RISK: 'risk.manage',
  VIEW_HISTORY: 'history.read',
  COMMENT_HISTORY: 'history.comment',
  SUBMIT_ITEM: 'item.submit',
  REVIEW_ITEM: 'item.review',
  VIEW_WORK_QUEUE: 'work_queue.read',
  VIEW_REVIEW_QUEUE: 'review_queue.read',
});

export const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

function scopeContains(scope, resource = {}) {
  if (scope?.type === 'global') return true;
  if (!scope) return false;
  if (scope.type === 'plan') return Boolean(resource.planId) && scope.planId === resource.planId;
  if (scope.type === 'axis') return Boolean(resource.planId && resource.axisId) && scope.planId === resource.planId && scope.axisId === resource.axisId;
  if (scope.type === 'item') return Boolean(resource.planId && resource.itemId) && scope.planId === resource.planId && scope.itemId === resource.itemId;
  return false;
}

export function can(session, permission, resource = {}) {
  if (!session?.grants || !permission) return false;
  return session.grants.some((grant) => grant.permission === permission && scopeContains(grant.scope, resource));
}

export function resourceFor(plan, item) {
  return {
    planId: plan?.id,
    axisId: item?.axisId,
    itemId: item?.id,
  };
}
