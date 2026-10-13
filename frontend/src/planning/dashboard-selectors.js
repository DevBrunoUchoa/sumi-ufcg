import { currentPeriod, metricResult, taskOverdue, years } from '../domain.js';
import { PERMISSIONS, resourceFor } from '../auth/permissions.js';
import { axisUrl, dashboardUrl, itemUrl, objectiveCode, objectiveUrl } from './navigation.js';
import { numericValue, ordered, summarizeScope, targetState } from './selectors.js';

export const attentionTypes = [
  { key: 'overdue', label: 'Etapas com prazo vencido' },
  { key: 'missing', label: 'Indicadores sem resultado' },
  { key: 'below', label: 'Metas não atingidas' },
  { key: 'no_target', label: 'Metas sem comparação' },
  { key: 'review', label: 'Aguardando validação', permission: PERMISSIONS.VIEW_REVIEW_QUEUE },
  { key: 'correction', label: 'Correções solicitadas', permission: PERMISSIONS.VIEW_WORK_QUEUE },
];

export function resolveDashboardScope(plan, query) {
  const axisId = query.get('axis') || '';
  const objectiveId = query.get('objective') || '';
  const axis = plan.axes.find((entry) => entry.id === axisId);
  const objective = plan.objectives.find((entry) => entry.id === objectiveId);
  const requestedPeriod = Number(query.get('period'));
  const focus = query.get('focus') || 'all';
  const valid = !(axisId && !axis) && !(objectiveId && !objective) && !(axis && objective && axis.id !== objective.axisId)
    && !(query.has('period') && !years(plan).includes(requestedPeriod))
    && (focus === 'all' || attentionTypes.some((entry) => entry.key === focus));
  const selectedAxis = axis || (objective && plan.axes.find((entry) => entry.id === objective.axisId));
  const items = ordered(plan.items.filter((item) => (!selectedAxis || item.axisId === selectedAxis.id) && (!objective || item.objectiveId === objective.id)));
  return { valid, axis: selectedAxis, objective, items, period: years(plan).includes(requestedPeriod) ? requestedPeriod : currentPeriod(plan), focus };
}

export function dashboardComparison(plan, scope) {
  const { axis, objective, items, period } = scope;
  if (objective) return { title: 'Execução por iniciativa', rows: items.map((item) => ({ id: item.id, label: `${item.code} · ${item.title}`, url: itemUrl(plan, item, 'indicadores', period), execution: summarizeScope([item], 0).execution })) };
  const groups = axis ? ordered(plan.objectives.filter((entry) => entry.axisId === axis.id)) : ordered(plan.axes);
  return { title: axis ? 'Execução por objetivo' : 'Execução por eixo', rows: groups.map((entry) => ({
    id: entry.id, label: `${axis ? objectiveCode(entry) : entry.code}${(axis ? objectiveCode(entry) : entry.code) ? ' · ' : ''}${axis ? entry.title : entry.name}`,
    url: dashboardUrl(plan, { axis: axis ? axis.id : entry.id, objective: axis ? entry.id : '', period }),
    execution: summarizeScope(items.filter((item) => axis ? item.objectiveId === entry.id : item.axisId === entry.id), 0).execution,
  })) };
}

export function dashboardFacts(plan, items, period, can = () => false, today = new Date()) {
  const applicable = items.filter((item) => item.metric.periodicity !== 'final' || period === plan.end);
  const hasResult = (item) => {
    const value = metricResult(item, period, today);
    return value != null && String(value).trim() !== '' && (item.metric.valueType === 'status' || numericValue(value) !== null);
  };
  const stages = items.flatMap((item) => item.actions.flatMap((action) => action.tasks)).filter((task) => task.status !== 'cancelled');
  const active = stages.filter((stage) => stage.status !== 'completed');
  const applicableIds = new Set(applicable.map((item) => item.id));
  const entries = items.map((item) => {
    const overdue = item.actions.flatMap((action) => action.tasks.filter((stage) => taskOverdue(stage, today)).map((stage) => ({ action, stage })));
    const state = targetState(item, period, plan, today);
    const reasons = [
      overdue.length && 'overdue', applicableIds.has(item.id) && !hasResult(item) && 'missing',
      state === 'below' && 'below', state === 'no_target' && 'no_target',
      can(PERMISSIONS.VIEW_REVIEW_QUEUE) && can(PERMISSIONS.REVIEW_ITEM, resourceFor(plan, item)) && item.reviewStatus === 'submitted' && 'review',
      can(PERMISSIONS.VIEW_WORK_QUEUE) && can(PERMISSIONS.SUBMIT_ITEM, resourceFor(plan, item)) && item.reviewStatus === 'changes_requested' && 'correction',
    ].filter(Boolean);
    return { item, reasons, overdue };
  }).filter((entry) => entry.reasons.length);
  return {
    execution: summarizeScope(items, 0).execution, entries,
    coverage: { total: applicable.length, withResult: applicable.filter(hasResult).length, missing: applicable.filter((item) => !hasResult(item)).length, cycle: items.length - applicable.length },
    deadlines: { overdue: stages.filter((stage) => taskOverdue(stage, today)).length, known: active.filter((stage) => stage.deadline).length, missing: active.filter((stage) => !stage.deadline).length },
    categories: attentionTypes.filter((entry) => !entry.permission || can(entry.permission)).map((entry) => ({ ...entry, count: entries.filter((candidate) => candidate.reasons.includes(entry.key)).length })),
  };
}

export const dashboardScopeUrl = (plan, scope) => {
  const path = scope.objective ? objectiveUrl(plan, scope.objective) : scope.axis ? axisUrl(plan, scope.axis) : `/plano/${encodeURIComponent(plan.id)}`;
  return `${path}?period=${scope.period}`;
};
