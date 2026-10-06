import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState } from '../src/data.js';
import { mergeLocalPreview } from '../src/planning/local-preview.js';

function seed() {
  const data = initialState();
  data.localPreview = { revision: 'test-v1' };
  const pdi = data.plans[0];
  pdi.items[0].title = 'Título da planilha';
  pdi.objectives.push({ id: 'local-objective', code: '1.1', title: 'Objetivo real', axisId: 'pdi-axis-1' });
  pdi.items.push({ ...structuredClone(pdi.items[0]), id: 'local-item', code: '1.1.1', axisId: 'pdi-axis-1', objectiveId: 'local-objective' });
  return data;
}

test('carga local substitui exemplos intactos, acrescenta eixos e preserva outros planos', () => {
  const current = initialState();
  current.plans[1].name = 'PLS editado';
  const before = structuredClone(current);
  const result = mergeLocalPreview(current, seed(), initialState());
  assert.equal(result.plans[0].items.length, 4);
  assert.equal(result.plans[0].items.find((i) => i.id === 'riscos').title, 'Título da planilha');
  assert.equal(result.plans[1].name, 'PLS editado');
  assert.deepEqual(current, before);
});

test('carga preserva edições existentes e remapeia referências para IDs locais', () => {
  const current = initialState();
  current.plans[0].items[0].title = 'Meu título editado';
  current.plans[0].axes[0].id = 'meu-eixo';
  current.plans[0].objectives.push({ id: 'meu-objetivo', code: '1.1', axisId: 'meu-eixo', title: 'Meu objetivo' });
  const result = mergeLocalPreview(current, seed(), initialState());
  assert.equal(result.plans[0].items.find((i) => i.id === 'riscos').title, 'Meu título editado');
  const added = result.plans[0].items.find((i) => i.id === 'local-item');
  assert.equal(added.axisId, 'meu-eixo');
  assert.equal(added.objectiveId, 'meu-objetivo');
});

test('mesma revisão não repõe iniciativas excluídas nem desfaz edições', () => {
  const incoming = seed();
  const current = mergeLocalPreview(initialState(), incoming, initialState());
  current.plans[0].items = current.plans[0].items.filter((i) => i.id !== 'local-item');
  current.plans[0].items[0].title = 'Edição após a carga';
  assert.strictEqual(mergeLocalPreview(current, incoming, initialState()), current);
});

test('fonte sem documentos locais não migra a base existente', () => {
  const current = initialState();
  assert.strictEqual(mergeLocalPreview(current, initialState(), initialState()), current);
});
