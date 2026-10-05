import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../src/data.js';
import { axisUrl, itemUrl, planUrl, resolvePlanRoute } from '../src/planning/navigation.js';
import { filterAxes, filterAxisItems, summarizeScope } from '../src/planning/selectors.js';

const pdi = initialState().plans[0];
const route = (url) => { const [path, query] = url.split('?'); return { path, query: new URLSearchParams(query) }; };

test('new scoped links and old bookmarks resolve to the same action and stage', () => {
  for (const url of [planUrl('pdi', 'riscos', 'riscos', undefined, 'comissao', 'minuta'), itemUrl(pdi, 'riscos', 'riscos', undefined, 'comissao', 'minuta')]) {
    const result = resolvePlanRoute(pdi, route(url));
    assert.equal(result.valid, true);
    assert.equal(result.axis.id, 'pdi-axis-8');
    assert.equal(result.objective.code, '8.1');
    assert.equal(result.action.id, 'comissao');
    assert.equal(result.stage.id, 'minuta');
    assert.equal(result.view, 'riscos');
  }
  assert.equal(resolvePlanRoute(pdi, route('/plano/pdi')).item, null);
  assert.equal(resolvePlanRoute(pdi, route('/plano/pdi/eixo/pdi-axis-1')).valid, true);
});

test('invalid or mismatched scope never silently selects a different resource', () => {
  for (const url of [
    '/plano/pdi/eixo/missing', '/plano/pdi/extra', '/plano/pdi/eixo/pdi-axis-1?item=riscos',
    '/plano/pdi?item=missing', '/plano/pdi?item=riscos&action=missing',
    '/plano/pdi?item=riscos&action=estrutura&stage=minuta&view=riscos',
    '/plano/pdi?item=riscos&view=riscos', '/plano/pdi?view=historico',
    '/plano/pdi/eixo/pdi-axis-1?objective=pdi-objective-8-1',
    '/plano/pdi?item=riscos&view=unexpected', '/plano/pdi/eixo/%E0%A4%A',
  ]) assert.equal(resolvePlanRoute(pdi, route(url)).valid, false, url);
});

test('URLs encode identifiers and preserve period and PLS bookmarks', () => {
  const plan = { id: 'plano / 1', type: 'PDI', axes: [{ id: 'eixo / 1' }], objectives: [{ id: 'obj 1', axisId: 'eixo / 1' }], items: [{ id: 'item & 1', axisId: 'eixo / 1', objectiveId: 'obj 1', actions: [] }] };
  const url = itemUrl(plan, plan.items[0], 'indicadores', 2027);
  assert.equal(resolvePlanRoute(plan, route(url)).item.id, 'item & 1');
  assert.equal(route(url).query.get('period'), '2027');
  assert.equal(resolvePlanRoute(plan, route(axisUrl(plan, plan.axes[0], 'obj 1'))).objective.id, 'obj 1');
  const pls = initialState().plans[1];
  assert.equal(itemUrl(pls, 'papel'), '/plano/pls?item=papel&view=indicadores');
});

test('axis filters and summaries are scoped and distinguish stage execution', () => {
  assert.equal(filterAxisItems(pdi, 'pdi-axis-1').length, 0);
  assert.equal(filterAxisItems(pdi, 'pdi-axis-8', { search: 'governanca publica' }).length, 2);
  assert.equal(filterAxisItems(pdi, 'pdi-axis-8', { objectiveId: 'pdi-objective-8-2' })[0].id, 'sustentabilidade');
  assert.equal(filterAxisItems(pdi, 'pdi-axis-8', { owner: 'missing' }).length, 0);
  assert.equal(filterAxes(pdi, 'rankings')[0].id, 'pdi-axis-8');
  const empty = summarizeScope([], 1);
  assert.equal(empty.execution.total, 0);
  const summary = summarizeScope([pdi.items[0]], 1);
  assert.equal(summary.actions, 4);
  assert.equal(summary.execution.percent, 20);
  const cancelled = structuredClone(pdi.items[0]);
  cancelled.actions[0].tasks[2].status = 'cancelled';
  assert.equal(summarizeScope([cancelled], 1).execution.total, 9);
});
