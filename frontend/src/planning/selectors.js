import { executionProgress, executionStatus, metricResult, normalize } from '../domain.js';

export const ordered = (entries) => [...entries].sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));

export const itemsForAxis = (plan, axisId) => plan.items.filter((item) => item.axisId === axisId);

// Counts and stage execution are separate from indicator achievement. These selectors
// also provide the data boundary for future visual summaries, without new API fields.
export function summarizeScope(items, objectiveCount) {
  const actions = items.flatMap((item) => item.actions);
  const execution = executionProgress({ actions });
  execution.percent = execution.total ? Math.round(execution.done / execution.total * 1000) / 10 : 0;
  return { objectives: objectiveCount, items: items.length, actions: actions.length, execution };
}

export const totalEstimatedBudget = (items) => items.reduce((total, item) => total + (Number(item.estimatedBudget) || 0), 0);

export const numericValue = (value) => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);

// A count of comparable indicators, never an average of unrelated units.
export function targetState(item, period, plan, now = new Date()) {
  if (item.metric.periodicity === 'final' && period !== plan.end) return 'cycle';
  const target = item.metric.targets[period];
  if (target == null || String(target).trim() === '' || (item.metric.valueType !== 'status' && numericValue(target) === null)) return 'no_target';
  const result = metricResult(item, period, now);
  if (result == null || String(result).trim() === '' || (item.metric.valueType !== 'status' && numericValue(result) === null)) return 'no_result';
  const reached = item.metric.valueType === 'status' ? normalize(target) === normalize(result)
    : item.metric.direction === 'down' ? Number(result) <= Number(target) : Number(result) >= Number(target);
  return reached ? 'reached' : 'below';
}

export const targetStates = [
  { key: 'reached', label: 'Meta atingida', tone: 'done' },
  { key: 'below', label: 'Meta não atingida', tone: 'active' },
  { key: 'no_result', label: 'Sem resultado', tone: 'pending' },
  { key: 'no_target', label: 'Sem meta comparável', tone: 'empty' },
  { key: 'cycle', label: 'Meta de ciclo', tone: 'cycle' },
];

export function targetDistribution(items, period, plan) {
  const states = items.map((item) => targetState(item, period, plan));
  return targetStates.map((state) => ({ ...state, value: states.filter((key) => key === state.key).length }));
}

export function stageDistribution(items) {
  const stages = items.flatMap((item) => item.actions.flatMap((action) => action.tasks));
  return [
    { key: 'completed', label: 'Concluídas', tone: 'done' },
    { key: 'in_progress', label: 'Em andamento', tone: 'active' },
    { key: 'not_started', label: 'Não iniciadas', tone: 'pending' },
    { key: 'cancelled', label: 'Canceladas', tone: 'empty' },
  ].map((state) => ({ ...state, value: stages.filter((stage) => stage.status === state.key).length }));
}

export function filterAxisItems(plan, axisId, { search = '', owner = '', status = '', objectiveId = '' } = {}) {
  const objectives = new Map(plan.objectives.map((objective) => [objective.id, objective]));
  return ordered(itemsForAxis(plan, axisId)).filter((item) => {
    const objective = objectives.get(item.objectiveId);
    return (!objectiveId || item.objectiveId === objectiveId)
      && (!owner || item.owner === owner)
      && (!status || executionStatus(item) === status)
      && normalize(`${item.code} ${item.title} ${objective?.code || ''} ${objective?.title || ''}`).includes(normalize(search));
  });
}

export function filterAxes(plan, search) {
  const query = normalize(search);
  if (!query) return ordered(plan.axes);
  return ordered(plan.axes).filter((axis) => normalize(`${axis.code} ${axis.name} ${axis.ownerUnit}`).includes(query)
    || plan.objectives.some((objective) => objective.axisId === axis.id && normalize(`${objective.code} ${objective.title}`).includes(query))
    || itemsForAxis(plan, axis.id).some((item) => normalize(`${item.code} ${item.title}`).includes(query)));
}
