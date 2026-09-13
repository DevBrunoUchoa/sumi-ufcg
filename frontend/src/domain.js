export const WORKSPACE_VERSION = 2;
export const uid = () => crypto.randomUUID();
export const years = (plan) => Array.from({ length: plan.end - plan.start + 1 }, (_, index) => plan.start + index);
export const periods = (plan, item) => item?.metric?.periodicity === 'final' ? [plan.end] : years(plan);
export const currentPeriod = (plan, item, now = new Date()) => item?.metric?.periodicity === 'final' ? plan.end : Math.max(plan.start, Math.min(now.getFullYear(), plan.end));
export const periodLabel = (plan, item, period) => item?.metric?.periodicity === 'final' ? `Ciclo ${plan.start}–${plan.end}` : String(period);
export const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const formatNumber = (value) => value == null || value === '' ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value));
export const formatDate = (value) => !value ? '—' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value));

export const stageStatusLabels = Object.freeze({ not_started: 'Não iniciada', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada' });
export const deliveryStatusLabels = Object.freeze({ not_started: 'Não iniciada', in_progress: 'Em elaboração', awaiting_validation: 'Aguardando validação', completed: 'Concluída', cancelled: 'Cancelada' });
export const reviewStatusLabels = Object.freeze({ draft: 'Em elaboração', submitted: 'Aguardando validação', validated: 'Validado', changes_requested: 'Correção solicitada' });
export const stageStatusLabel = (value) => stageStatusLabels[value] || value || 'Não iniciada';
export const reviewStatusLabel = (value) => reviewStatusLabels[value] || reviewStatusLabels.draft;

export const taskOverdue = (task, today = new Date()) => {
  if (['completed', 'cancelled'].includes(task.status) || !task.deadline) return false;
  return new Date(`${task.deadline}T23:59:59`) < today;
};

export const actionProgress = (action) => {
  const active = action.tasks.filter((task) => task.status !== 'cancelled');
  const done = active.filter((task) => task.status === 'completed').length;
  return { total: active.length, done, percent: active.length ? Math.round(done / active.length * 100) : 0 };
};

export const taskProgress = (item) => {
  const tasks = item.actions.flatMap((action) => action.tasks).filter((task) => task.status !== 'cancelled');
  const done = tasks.filter((task) => task.status === 'completed').length;
  return { total: tasks.length, done, percent: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
};

export const executionProgress = taskProgress;
export const executionStatus = (item) => {
  const tasks = item.actions.flatMap((action) => action.tasks);
  if (!tasks.length || tasks.every((task) => task.status === 'not_started')) return 'Não iniciada';
  if (tasks.every((task) => task.status === 'cancelled')) return 'Cancelada';
  if (tasks.every((task) => ['completed', 'cancelled'].includes(task.status))) return 'Concluída';
  return 'Em andamento';
};

export const latestMeasurement = (item, period) => item.measurements.filter((entry) => Number(entry.year) === Number(period)).at(-1);
export function metricResult(item, period, now = new Date()) {
  if (item.metric.measurementMode !== 'stages') return latestMeasurement(item, period)?.value;
  if (item.metric.periodicity === 'final' || Number(period) === now.getFullYear()) return taskProgress(item).percent;
  return latestMeasurement(item, period)?.value;
}

export function formatMetricValue(item, value) {
  if (value == null || value === '') return '—';
  if (item.metric.valueType === 'status') return deliveryStatusLabels[value] || String(value);
  return formatNumber(value);
}

export function metricStatus(item, period) {
  const target = item.metric.targets[period];
  if (target == null || target === '') return 'Sem meta definida';
  const result = metricResult(item, period);
  if (result == null || result === '') return 'Sem resultado';
  if (item.metric.valueType === 'status') return normalize(result) === normalize(target) ? 'Meta atingida' : 'Em acompanhamento';
  const reached = item.metric.direction === 'down' ? Number(result) <= Number(target) : Number(result) >= Number(target);
  return reached ? 'Meta atingida' : 'Meta não atingida';
}

export function metricAchievement(item, period) {
  const target = item.metric.targets[period];
  const result = metricResult(item, period);
  if (target == null || target === '' || result == null || result === '') return null;
  if (item.metric.valueType === 'status') return normalize(result) === normalize(target) ? 100 : 0;
  const numericTarget = Number(target);
  const numericResult = Number(result);
  if (!Number.isFinite(numericTarget) || !Number.isFinite(numericResult)) return null;
  if (numericTarget === 0) return item.metric.direction === 'down' && numericResult <= 0 ? 100 : null;
  if (item.metric.direction === 'down') {
    if (numericResult <= numericTarget) return 100;
    if (numericResult === 0) return 100;
    return Math.max(0, Math.round(Math.min(numericTarget / numericResult * 100, 100)));
  }
  return Math.max(0, Math.round(Math.min(numericResult / numericTarget * 100, 100)));
}

export const metricTone = (item, period) => {
  const achievement = metricAchievement(item, period);
  if (achievement == null) return 'neutral';
  if (item.metric.valueType === 'status') return achievement === 100 ? 'green' : 'blue';
  return achievement >= 100 ? 'green' : achievement > 25 ? 'attention' : 'critical';
};

export const axisFor = (plan, item) => plan.axes.find((axis) => axis.id === item?.axisId);
export const objectiveFor = (plan, item) => plan.objectives.find((objective) => objective.id === item?.objectiveId);
export const axisLabel = (axis) => axis ? `${axis.code} · ${axis.name}` : 'Eixo não identificado';
export const objectiveLabel = (objective) => objective ? `${objective.code} · ${objective.title}` : 'Objetivo não identificado';

export const riskScore = (probability, impact) => probability * impact;
export const riskLevelFromScore = (score) => score <= 3 ? 'low' : score <= 6 ? 'moderate' : score <= 12 ? 'high' : 'critical';
export const riskLevel = (probability, impact) => riskLevelFromScore(riskScore(probability, impact));
export const riskLevelLabel = (level) => ({ low: 'Baixo', moderate: 'Moderado', high: 'Alto', critical: 'Crítico' })[level];
export const controlFactor = (maturity) => ({ Inexistente: 1, Fraco: 0.8, Mediano: 0.6, Satisfatório: 0.4, Forte: 0.2 })[maturity] ?? 1;
export const residualRisk = (probability, impact, maturity) => riskScore(probability, impact) * controlFactor(maturity);

export function validateRange(start, end) {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 2020 && end <= 2100 && end >= start && end - start <= 10;
}

export function createPlan(template, values) {
  if (!values.name.trim() || !values.shortName.trim() || !validateRange(values.start, values.end)) throw new Error('Informe nome, sigla e uma vigência válida de até 11 anos.');
  return { ...values, id: uid(), name: values.name.trim(), shortName: values.shortName.trim(), template: structuredClone(template), type: template.type, status: 'draft', axes: [], objectives: [], items: [] };
}

export const historyEntry = (text, actor = 'Usuário do sistema', details = {}) => ({ id: uid(), at: new Date().toISOString(), text, actor, ...details });

const present = (value) => typeof value === 'string' && value.trim().length > 0;
const validMetric = (metric) => metric && present(metric.name) && ['manual', 'delivery', 'stages'].includes(metric.measurementMode)
  && ['number', 'percentage', 'status'].includes(metric.valueType) && ['annual', 'final'].includes(metric.periodicity)
  && metric.targets && typeof metric.targets === 'object' && !Array.isArray(metric.targets);
const validAction = (action) => action && present(action.id) && present(action.code) && present(action.title) && Array.isArray(action.tasks)
  && action.tasks.every((task) => present(task?.id) && present(task?.title) && Object.hasOwn(stageStatusLabels, task.status));
const validItem = (item) => item && present(item.id) && present(item.code) && present(item.title) && present(item.axisId) && present(item.objectiveId)
  && validMetric(item.metric) && Array.isArray(item.actions) && item.actions.every(validAction) && Array.isArray(item.measurements)
  && Array.isArray(item.history) && Array.isArray(item.risks);
const validPlan = (plan) => plan && present(plan.id) && present(plan.name) && present(plan.shortName) && validateRange(plan.start, plan.end)
  && plan.template?.labels && Array.isArray(plan.axes) && plan.axes.every((axis) => present(axis?.id) && present(axis?.code) && present(axis?.name))
  && Array.isArray(plan.objectives) && plan.objectives.every((objective) => present(objective?.id) && present(objective?.axisId) && present(objective?.code) && present(objective?.title))
  && Array.isArray(plan.items) && plan.items.every(validItem);

export function validateWorkspace(value) {
  return value?.version === WORKSPACE_VERSION && Array.isArray(value.templates) && Array.isArray(value.plans)
    && value.templates.every((template) => present(template?.id) && present(template?.type) && template.labels && Array.isArray(template.fields))
    && value.plans.every(validPlan);
}
