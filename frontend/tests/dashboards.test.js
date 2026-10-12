import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../src/data.js';
import { objectiveUrl, resolvePlanRoute } from '../src/planning/navigation.js';
import { safeReturnPath } from '../src/auth/navigation.js';
import { stageDistribution, targetDistribution, targetState } from '../src/planning/selectors.js';

const route = (url) => { const [path, query] = url.split('?'); return { path, query: new URLSearchParams(query) }; };
const plan = initialState().plans[0];

test('objetivo possui rota própria, preserva retorno do login e rejeita vínculos incompatíveis', () => {
  const objective = plan.objectives[0];
  const url = objectiveUrl(plan, objective);
  assert.equal(resolvePlanRoute(plan, route(url)).objective.id, objective.id);
  assert.equal(safeReturnPath(url), url);
  assert.equal(resolvePlanRoute(plan, route(url.replace('pdi-axis-8', 'pdi-axis-1'))).valid, false);
  assert.equal(resolvePlanRoute(plan, route(`${url}?objective=outro`)).valid, false);
  assert.equal(resolvePlanRoute(plan, route(`${url}?item=sustentabilidade`)).valid, false);
  assert.equal(resolvePlanRoute(plan, route('/plano/pdi/eixo/pdi-axis-8?objective=pdi-objective-8-1')).valid, true);
});

test('metas distinguem ausência, zero, redução, texto e ciclo sem fazer médias', () => {
  const item = structuredClone(plan.items[1]);
  item.metric.measurementMode = 'manual'; item.metric.valueType = 'number'; item.metric.direction = 'up';
  item.metric.targets = { 2026: 5 }; item.measurements = [];
  assert.equal(targetState(item, 2026, plan), 'no_result');
  item.measurements = [{ year: 2026, value: 0 }];
  assert.equal(targetState(item, 2026, plan), 'below');
  item.metric.targets[2026] = 0;
  assert.equal(targetState(item, 2026, plan), 'reached');
  item.metric.targets[2026] = 2; item.metric.direction = 'down';
  assert.equal(targetState(item, 2026, plan), 'reached');
  item.metric.targets[2026] = '>90%';
  assert.equal(targetState(item, 2026, plan), 'no_target');
  item.metric.periodicity = 'final'; item.metric.targets = { 2030: 10 };
  assert.equal(targetState(item, 2026, plan), 'cycle');
  const distribution = targetDistribution([item, ...plan.items], 2026, plan);
  assert.equal(distribution.reduce((sum, value) => sum + value.value, 0), plan.items.length + 1);
});

test('distribuição de etapas inclui canceladas sem alterar o denominador da execução', () => {
  const item = structuredClone(plan.items[0]);
  item.actions[0].tasks[0].status = 'cancelled';
  const values = stageDistribution([item]);
  assert.equal(values.find((entry) => entry.key === 'cancelled').value, 1);
  assert.equal(values.reduce((sum, entry) => sum + entry.value, 0), item.actions.flatMap((action) => action.tasks).length);
});
