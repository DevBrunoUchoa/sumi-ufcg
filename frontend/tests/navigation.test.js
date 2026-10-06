import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../src/data.js';
import { safeReturnPath, loginUrl } from '../src/auth/navigation.js';
import { breadcrumbsFor } from '../src/layout/breadcrumbs.js';

const route = (url) => { const [path, query] = url.split('?'); return { path, query: new URLSearchParams(query) }; };

test('retorno do login preserva o contexto e rejeita destinos externos', () => {
  const path = '/plano/pdi/eixo/pdi-axis-8?item=riscos&action=comissao&stage=minuta&view=riscos';
  assert.equal(safeReturnPath(path), path);
  assert.equal(route(loginUrl(route(path))).query.get('returnTo'), path);
  for (const invalid of ['https://example.org', '//example.org', '/\\example.org', '/inicio\r\n', '/login', '/desconhecido', null]) {
    assert.equal(safeReturnPath(invalid), '/inicio');
  }
});

test('hierarquia liga o risco à sua ação e etapa nos dois formatos de URL', () => {
  const pdi = initialState().plans[0];
  for (const path of ['/plano/pdi', '/plano/pdi/eixo/pdi-axis-8']) {
    const entries = breadcrumbsFor(route(`${path}?item=riscos&action=comissao&stage=minuta&view=riscos`), pdi);
    assert.deepEqual(entries.slice(0, 3).map((entry) => entry.label), ['Início', 'Planos', 'PDI 2026–2030']);
    assert.match(entries[3].label, /^Eixo 8/);
    assert.match(entries[4].label, /^Objetivo 8.1/);
    assert.match(entries[5].label, /^Iniciativa 8.1.3/);
    assert.match(entries[6].label, /^Ação /);
    assert.match(entries[7].label, /^Riscos da etapa/);
    assert.match(entries[6].url, /action=comissao/);
    assert.match(entries[5].url, /item=riscos/);
  }
});

test('PLS mantém os links de consulta existentes sem criar rota de eixo inexistente', () => {
  const pls = initialState().plans[1];
  const entries = breadcrumbsFor(route('/plano/pls?item=papel&view=indicadores'), pls);
  assert.equal(entries[3].url, undefined);
  assert.equal(entries[4].url, undefined);
  assert.equal(entries[5].url, '/plano/pls?item=papel&view=indicadores');
});
