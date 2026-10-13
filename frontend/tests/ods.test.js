import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/data.js';
import { odsForObjective } from '../src/planning/ods.js';

const plan = () => initialState().plans.find((entry) => entry.type === 'PDI');
const ids = (icons) => icons.map((icon) => icon.id);

test('vínculos são específicos do objetivo, não a união do eixo', () => {
  const pdi = plan();
  assert.deepEqual(ids(odsForObjective(pdi, pdi.objectives[0])), [16]);
  assert.deepEqual(ids(odsForObjective(pdi, pdi.objectives[1])), [10, 16]);
  assert.deepEqual(odsForObjective(pdi, { ...pdi.objectives[0], title: 'Outro objetivo com o mesmo código' }), []);
});

test('pesquisa preserva as 17 ODS e cada uma possui identificação e ativo local', () => {
  const icons = odsForObjective(plan(), { axisId: 'pdi-axis-2', code: '2.1', title: 'Fortalecer as iniciativas de inovação' });
  assert.deepEqual(ids(icons), Array.from({ length: 17 }, (_, index) => index + 1));
  assert.ok(icons.every((icon) => icon.title && icon.path.endsWith('.svg') && icon.page.startsWith('https://brasil.un.org/pt-br/sdgs/')));
});

test('o título importado no lugar do código não impede o vínculo documentado', () => {
  const pdi = plan();
  const objective = { axisId: 'pdi-axis-6', code: 'Melhorar infraestrutura física e urbana', title: 'Melhorar infraestrutura física e urbana' };
  assert.deepEqual(ids(odsForObjective(pdi, objective)), [9, 16]);
  assert.deepEqual(odsForObjective(pdi, { ...objective, axisId: 'pdi-axis-8' }), []);
  assert.deepEqual(ids(odsForObjective(pdi, { axisId: 'pdi-axis-6', code: '6.4', title: 'Promover assessoramento aos setores da UFCG para que a cultura da inclusão e acessibilidade se constitua como princípio transversal' })), [4, 8, 10]);
});

test('não atribui ODS a outros planos, vigências ou objetivos sem correspondência', () => {
  const pdi = plan();
  const objective = pdi.objectives[0];
  assert.deepEqual(odsForObjective({ ...pdi, type: 'PLS' }, objective), []);
  assert.deepEqual(odsForObjective({ ...pdi, start: 2031, end: 2035 }, objective), []);
  assert.deepEqual(odsForObjective(pdi, null), []);
  assert.deepEqual(ids(odsForObjective(pdi, { ...objective, title: '  aperfeiçoar práticas de GOVERNANÇA pública. ' })), [16]);
});
