import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../src/data.js';
import {
  actionProgress,
  createPlan,
  executionStatus,
  formatMetricValue,
  latestMeasurement,
  metricAchievement,
  metricResult,
  metricStatus,
  metricTone,
  normalize,
  periods,
  riskLevel,
  riskLevelLabel,
  taskOverdue,
  taskProgress,
  validateRange,
  validateWorkspace,
  years,
} from '../src/domain.js';
import { can, PERMISSIONS } from '../src/auth/permissions.js';
import { normalizeSession } from '../src/auth/session-client.js';

test('fixtures representam as hierarquias próprias do PDI e do PLS', () => {
  const state = initialState();
  const [pdi, pls] = state.plans;
  assert.equal(validateWorkspace(state), true);
  assert.equal(pdi.template.labels.item, 'Iniciativa');
  assert.equal(pls.template.labels.item, 'Meta');
  assert.equal(pdi.items.length, 3);
  assert.equal(pls.items.length, 4);
  assert.equal(pdi.items[2].linkedPlan, 'pls');
  assert.equal(pdi.items[0].code, '8.1.3');
  assert.deepEqual(pdi.items[0].metric.targets, { 2026: 80, 2027: 100, 2028: null, 2029: null, 2030: null });
});

test('PLS aceita medida numérica, entrega descritiva e execução calculada', () => {
  const pls = initialState().plans[1];
  const modes = Object.fromEntries(pls.items.map((item) => [item.id, item.metric.measurementMode]));
  assert.deepEqual(modes, { papel: 'manual', 'politica-desfazimento': 'stages', 'guia-compras': 'delivery', dimensionamento: 'delivery' });
  const guide = pls.items.find((item) => item.id === 'guia-compras');
  assert.equal(guide.metric.valueType, 'status');
  assert.equal(formatMetricValue(guide, 'in_progress'), 'Em elaboração');
});

test('execução é calculada somente com etapas ativas', () => {
  const item = initialState().plans[0].items[0];
  assert.deepEqual(taskProgress(item), { done: 2, total: 10, percent: 20 });
  assert.deepEqual(actionProgress(item.actions[0]), { done: 2, total: 5, percent: 40 });
  item.actions[0].tasks[2].status = 'completed';
  item.actions[0].tasks[3].status = 'cancelled';
  assert.deepEqual(actionProgress(item.actions[0]), { done: 3, total: 4, percent: 75 });
});

test('situação da execução cobre ausência, início, andamento e encerramento', () => {
  const item = { actions: [] };
  assert.equal(executionStatus(item), 'Não iniciada');
  item.actions = [{ tasks: [{ status: 'not_started' }, { status: 'not_started' }] }];
  assert.equal(executionStatus(item), 'Não iniciada');
  item.actions[0].tasks[0].status = 'in_progress';
  assert.equal(executionStatus(item), 'Em andamento');
  item.actions[0].tasks[0].status = 'completed';
  item.actions[0].tasks[1].status = 'cancelled';
  assert.equal(executionStatus(item), 'Concluída');
  item.actions[0].tasks[0].status = 'cancelled';
  assert.equal(executionStatus(item), 'Cancelada');
});

test('atraso respeita prazo e situações encerradas', () => {
  const today = new Date('2026-09-11T12:00:00');
  assert.equal(taskOverdue({ deadline: '2026-09-10', status: 'in_progress' }, today), true);
  assert.equal(taskOverdue({ deadline: '2026-09-11', status: 'not_started' }, today), false);
  assert.equal(taskOverdue({ deadline: '2026-09-10', status: 'completed' }, today), false);
  assert.equal(taskOverdue({ deadline: '2026-09-10', status: 'cancelled' }, today), false);
  assert.equal(taskOverdue({ deadline: '', status: 'not_started' }, today), false);
});

test('indicador por etapas usa execução atual e preserva fechamentos anuais', () => {
  const item = initialState().plans[0].items[0];
  const now = new Date('2026-09-12T12:00:00');
  assert.equal(metricResult(item, 2026, now), 20);
  assert.equal(metricResult(item, 2027, now), undefined);
  item.measurements.push({ id: 'fechamento-2025', year: 2025, value: 75 });
  assert.equal(metricResult(item, 2025, now), 75);
});

test('metas numéricas respeitam ausência, zero e sentido de melhoria', () => {
  const pdi = initialState().plans[0].items[0];
  assert.equal(metricStatus(pdi, 2028), 'Sem meta definida');
  assert.equal(metricAchievement(pdi, 2026), 25);
  assert.equal(metricTone(pdi, 2026), 'critical');
  const paper = initialState().plans[1].items[0];
  assert.equal(latestMeasurement(paper, 2026).value, 960);
  assert.equal(metricStatus(paper, 2026), 'Meta não atingida');
  assert.equal(metricAchievement(paper, 2026), 94);
  paper.metric.targets[2026] = 0;
  paper.measurements.push({ year: 2026, value: 0 });
  assert.equal(metricStatus(paper, 2026), 'Meta atingida');
  assert.equal(metricAchievement(paper, 2026), 100);
});

test('entrega descritiva só atinge a meta ao chegar à situação esperada', () => {
  const item = initialState().plans[1].items.find((candidate) => candidate.id === 'guia-compras');
  assert.equal(metricStatus(item, 2030), 'Em acompanhamento');
  assert.equal(metricAchievement(item, 2030), 0);
  assert.equal(metricTone(item, 2030), 'blue');
  item.measurements.push({ year: 2030, value: 'completed' });
  assert.equal(metricStatus(item, 2030), 'Meta atingida');
  assert.equal(metricAchievement(item, 2030), 100);
});

test('períodos anuais e de ciclo são produzidos sem inventar anos', () => {
  const [pdi, pls] = initialState().plans;
  assert.deepEqual(years({ start: 2026, end: 2028 }), [2026, 2027, 2028]);
  assert.deepEqual(periods(pdi, pdi.items[0]), [2026, 2027, 2028, 2029, 2030]);
  assert.deepEqual(periods(pls, pls.items.find((item) => item.id === 'guia-compras')), [2030]);
  assert.equal(validateRange(2026, 2030), true);
  for (const [start, end] of [[2026, 2025], [2026.5, 2030], [2019, 2026], [2026, 2101], [2026, 2040]]) assert.equal(validateRange(start, end), false);
});

test('novo plano nasce rascunho, vazio e independente do modelo', () => {
  const template = initialState().templates[1];
  const plan = createPlan(template, { name: ' Plano local ', shortName: ' PLS ', start: 2027, end: 2030 });
  assert.equal(plan.status, 'draft');
  assert.deepEqual(plan.axes, []);
  assert.deepEqual(plan.objectives, []);
  assert.deepEqual(plan.items, []);
  assert.equal(plan.name, 'Plano local');
  template.labels.item = 'Entrega';
  assert.equal(plan.template.labels.item, 'Meta');
  assert.throws(() => createPlan(template, { name: ' ', shortName: 'X', start: 2026, end: 2030 }));
});

test('estado é independente, validado e busca ignora acentos', () => {
  const a = initialState();
  a.plans[0].items.pop();
  assert.equal(initialState().plans[0].items.length, 3);
  assert.equal(validateWorkspace({ ...initialState(), version: 1 }), false);
  assert.equal(validateWorkspace({ ...initialState(), plans: [{}] }), false);
  const malformed = initialState();
  malformed.plans[0].items[0].actions[0].tasks[0].status = 'unknown';
  assert.equal(validateWorkspace(malformed), false);
  assert.equal(normalize('Água e AÇÕES'), 'agua e acoes');
  assert.equal(riskLevel(4, 4), 'critical');
  assert.equal(riskLevelLabel(riskLevel(2, 2)), 'Moderado');
});

test('autorização depende do grant e nega escopo ausente ou wildcard', () => {
  const global = { grants: [{ permission: PERMISSIONS.VIEW_PUBLISHED_PLAN, scope: { type: 'global' } }] };
  assert.equal(can(global, PERMISSIONS.VIEW_PUBLISHED_PLAN), true);
  assert.equal(can(global, PERMISSIONS.VIEW_INTERNAL_PLAN), false);
  assert.equal(can({ grants: [{ permission: '*', scope: { type: 'global' } }] }, PERMISSIONS.MANAGE_PLAN), false);
  assert.equal(can({ grants: [{ permission: PERMISSIONS.MANAGE_PLAN }] }, PERMISSIONS.MANAGE_PLAN), false);
});

test('concessões de plano, eixo e item não escapam do recurso', () => {
  const planSession = { grants: [{ permission: PERMISSIONS.RECORD_RESULT, scope: { type: 'plan', planId: 'pdi' } }] };
  assert.equal(can(planSession, PERMISSIONS.RECORD_RESULT, { planId: 'pdi', itemId: 'a' }), true);
  assert.equal(can(planSession, PERMISSIONS.RECORD_RESULT, { planId: 'pls', itemId: 'a' }), false);
  const axisSession = { grants: [{ permission: PERMISSIONS.UPDATE_STAGE, scope: { type: 'axis', planId: 'pdi', axisId: 'eixo-8' } }] };
  assert.equal(can(axisSession, PERMISSIONS.UPDATE_STAGE, { planId: 'pdi', axisId: 'eixo-8', itemId: 'a' }), true);
  assert.equal(can(axisSession, PERMISSIONS.UPDATE_STAGE, { planId: 'pdi', axisId: 'eixo-7', itemId: 'a' }), false);
  const itemSession = { grants: [{ permission: PERMISSIONS.REVIEW_ITEM, scope: { type: 'item', planId: 'pdi', itemId: 'riscos' } }] };
  assert.equal(can(itemSession, PERMISSIONS.REVIEW_ITEM, { planId: 'pdi', itemId: 'riscos' }), true);
  assert.equal(can(itemSession, PERMISSIONS.REVIEW_ITEM, { planId: 'pdi', itemId: 'rankings' }), false);
});

test('sessão segue o contrato e mantém consulta pública no 401', () => {
  const anonymous = normalizeSession({ authenticated: false });
  assert.equal(anonymous.authenticated, false);
  assert.equal(can(anonymous, PERMISSIONS.VIEW_PUBLISHED_PLAN), true);
  const authenticated = normalizeSession({ authenticated: true, user: { id: 42, name: ' Pessoa ', email: null }, roles: [], grants: [{ permission: PERMISSIONS.VIEW_PUBLISHED_PLAN, scope: { type: 'global' } }] });
  assert.equal(authenticated.user.id, '42');
  assert.equal(authenticated.user.name, 'Pessoa');
  assert.equal(authenticated.user.email, null);
  assert.throws(() => normalizeSession({ authenticated: true, user: { id: '1', name: '' }, roles: [], grants: [] }));
  assert.throws(() => normalizeSession({ authenticated: true, user: { id: '1', name: 'Pessoa' }, roles: [], grants: [{ permission: PERMISSIONS.RECORD_RESULT, scope: { type: 'axis', planId: 'pdi' } }] }));
  assert.throws(() => normalizeSession({ authenticated: true, user: { id: '1', name: 'Pessoa' }, roles: [], grants: [{ permission: PERMISSIONS.RECORD_RESULT, scope: { type: 'global' } }] }));
});
