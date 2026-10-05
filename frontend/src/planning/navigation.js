const segment = (value) => encodeURIComponent(value);

// Existing bookmarks keep their query parameters; new PDI links add axis context.
export function planUrl(id, item, view = 'indicadores', period, actionId, stageId) {
  const query = new URLSearchParams();
  if (item) {
    query.set('item', item);
    query.set('view', view);
    if (actionId) query.set('action', actionId);
    if (stageId) query.set('stage', stageId);
    if (period) query.set('period', period);
  }
  return `/plano/${segment(id)}${query.size ? `?${query}` : ''}`;
}

export function axisUrl(plan, axis, objectiveId) {
  const path = `${planUrl(plan.id)}/eixo/${segment(typeof axis === 'string' ? axis : axis.id)}`;
  return objectiveId ? `${path}?objective=${segment(objectiveId)}` : path;
}

export function itemUrl(plan, itemOrId, view = 'indicadores', period, actionId, stageId) {
  const item = typeof itemOrId === 'object' ? itemOrId : plan.items.find((entry) => entry.id === itemOrId);
  const legacy = planUrl(plan.id, item?.id || itemOrId, view, period, actionId, stageId);
  if (plan.type !== 'PDI' || !item) return legacy;
  return `${axisUrl(plan, item.axisId)}?${legacy.split('?')[1]}`;
}

export function resolvePlanRoute(plan, route) {
  let parts;
  try { parts = route.path.split('/').filter(Boolean).map(decodeURIComponent); } catch { return { valid: false }; }
  if (parts[0] !== 'plano' || parts[1] !== plan.id || !(parts.length === 2 || (parts.length === 4 && parts[2] === 'eixo'))) return { valid: false };
  const axisId = parts[3];
  const requestedItem = route.query.get('item');
  const item = requestedItem ? plan.items.find((entry) => entry.id === requestedItem) : null;
  const axis = plan.axes.find((entry) => entry.id === (axisId || item?.axisId));
  const objectiveId = route.query.get('objective');
  const objective = plan.objectives.find((entry) => entry.id === (item?.objectiveId || objectiveId));
  const actionId = route.query.get('action');
  const action = item?.actions.find((entry) => entry.id === actionId);
  const stageId = route.query.get('stage');
  const stage = action?.tasks.find((entry) => entry.id === stageId);
  const requestedView = route.query.get('view') || route.query.get('tab') || 'indicadores';
  const valid = !((axisId && !axis) || (requestedItem && !item) || (item && (!axis || !objective || item.axisId !== axis.id || objective.axisId !== axis.id))
    || (objectiveId && (!objective || objective.axisId !== axis?.id || objective.id !== objectiveId))
    || (actionId && !action) || (stageId && !stage) || (stageId && requestedView !== 'riscos')
    || !['indicadores', 'historico', 'acao', 'riscos'].includes(requestedView)
    || (['acao', 'riscos'].includes(requestedView) && !action) || (!item && (route.query.has('view') || route.query.has('tab'))));
  const view = action ? requestedView === 'riscos' ? 'riscos' : 'acao' : requestedView;
  return { valid, axis, objective, item, action, stage, view };
}
