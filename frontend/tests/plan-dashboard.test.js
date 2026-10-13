import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../src/data.js';
import { metricResult } from '../src/domain.js';
import { can } from '../src/auth/permissions.js';
import { safeReturnPath } from '../src/auth/navigation.js';
import { developmentSessions } from '../dev/session-fixtures.js';
import { dashboardUrl } from '../src/planning/navigation.js';
import { dashboardComparison, dashboardFacts, dashboardScopeUrl, resolveDashboardScope } from '../src/planning/dashboard-selectors.js';
import { PERMISSIONS } from '../src/auth/permissions.js';

const today = new Date('2026-10-12T12:00:00-03:00');
const plan = initialState().plans[0];
const permissions = (profile) => (permission, resource) => can(developmentSessions[profile], permission, resource);

test('painel preserva filtros, códigos UUID e retorno do login; vínculos incorretos são negados', () => {
  const scope = resolveDashboardScope(plan, new URLSearchParams('objective=pdi-objective-8-1&period=2027'));
  assert.equal(scope.valid, true);
  assert.equal(scope.axis.id, 'pdi-axis-8');
  assert.equal(scope.items.length, 2);
  assert.equal(scope.period, 2027);
  assert.equal(dashboardScopeUrl(plan, scope), '/plano/pdi/eixo/pdi-axis-8/objetivo/pdi-objective-8-1?period=2027');
  const url = dashboardUrl(plan, { axis: scope.axis.id, objective: scope.objective.id, period: scope.period });
  assert.equal(safeReturnPath(url), url);
  for (const query of ['axis=missing', 'objective=missing', 'axis=pdi-axis-1&objective=pdi-objective-8-1', 'period=2040', 'period=invalid', 'focus=unknown']) assert.equal(resolveDashboardScope(plan, new URLSearchParams(query)).valid, false, query);
  const clone = structuredClone(plan);
  clone.id = '1f820ef7-4d2b-4f54-a8d3-b4485b7a9ab2';
  assert.ok(dashboardUrl(clone).includes(clone.id));
});

test('comparação aprofunda o painel por eixo e objetivo e conserva o ano', () => {
  const scope = resolveDashboardScope(plan, new URLSearchParams('period=2027'));
  const axes = dashboardComparison(plan, scope);
  assert.equal(axes.rows.length, 8);
  assert.ok(axes.rows[7].url.includes('axis=pdi-axis-8'));
  assert.ok(axes.rows[7].url.includes('period=2027'));
  const objectives = dashboardComparison(plan, resolveDashboardScope(plan, new URLSearchParams('axis=pdi-axis-8')));
  assert.equal(objectives.rows.length, 2);
  const items = dashboardComparison(plan, resolveDashboardScope(plan, new URLSearchParams('objective=pdi-objective-8-1')));
  assert.equal(items.rows.length, 2);
  assert.ok(items.rows[0].url.includes('item='));
});

test('cobertura distingue resultado zero, ausência de etapas e metas de ciclo', () => {
  const zero = structuredClone(plan.items[1]);
  zero.id = 'zero'; zero.measurements = [{ year: 2026, value: 0 }];
  const missingStages = structuredClone(plan.items[0]);
  missingStages.id = 'missing-stages'; missingStages.actions = [];
  assert.equal(metricResult(missingStages, 2026, today), undefined);
  const cycle = structuredClone(zero); cycle.id = 'cycle'; cycle.metric.periodicity = 'final';
  const facts = dashboardFacts(plan, [zero, missingStages, cycle], 2026, permissions('public'), today);
  assert.deepEqual(facts.coverage, { total: 2, withResult: 1, missing: 1, cycle: 1 });
  assert.ok(facts.entries.find((entry) => entry.item.id === 'missing-stages').reasons.includes('missing'));
});

test('prazos ausentes e etapas canceladas não viram atrasos; revisão respeita o eixo', () => {
  const item = structuredClone(plan.items[0]);
  item.actions[0].tasks = [
    { id: 'a', title: 'Sem prazo', status: 'not_started', deadline: '' },
    { id: 'b', title: 'Cancelada', status: 'cancelled', deadline: '2026-01-01' },
  ];
  item.actions = [item.actions[0]];
  const facts = dashboardFacts(plan, [item, plan.items[1]], 2026, permissions('public'), today);
  assert.equal(facts.deadlines.overdue, 0);
  assert.equal(facts.deadlines.missing, 1);
  assert.equal(facts.categories.some((entry) => entry.key === 'review'), false);
  assert.equal(facts.entries.some((entry) => entry.reasons.includes('review') || entry.reasons.includes('correction')), false);
  const reviewer = dashboardFacts(plan, plan.items, 2026, permissions('axis_reviewer'), today);
  assert.equal(reviewer.categories.find((entry) => entry.key === 'review').count, 1);
  const otherAxis = { ...structuredClone(plan.items[1]), id: 'outside', axisId: 'pdi-axis-1' };
  assert.equal(dashboardFacts(plan, [otherAxis], 2026, permissions('axis_reviewer'), today).entries.some((entry) => entry.reasons.includes('review')), false);
  const itemPermissionOnly = (permission) => permission === PERMISSIONS.REVIEW_ITEM;
  assert.equal(dashboardFacts(plan, plan.items, 2026, itemPermissionOnly, today).entries.some((entry) => entry.reasons.includes('review')), false);
});

test('resultado descritivo em branco não aumenta a cobertura nem atinge a meta', () => {
  const item = structuredClone(plan.items[1]);
  item.metric.measurementMode = 'delivery'; item.metric.valueType = 'status';
  item.metric.targets[2026] = 'Concluído'; item.measurements = [{ year: 2026, value: '  ' }];
  const facts = dashboardFacts(plan, [item], 2026, permissions('public'), today);
  assert.equal(facts.coverage.withResult, 0);
  assert.ok(facts.entries[0].reasons.includes('missing'));
});
