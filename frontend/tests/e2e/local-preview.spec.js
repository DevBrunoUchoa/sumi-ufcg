import { existsSync, readFileSync } from 'node:fs';
import { test, expect, chooseOption } from './fixtures.js';
import { initialState } from '../../src/data.js';
import { itemUrl } from '../../src/planning/navigation.js';

const path = new URL('../../../.local-preview/workspace.json', import.meta.url);
const seed = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
const plan = seed?.plans.find((p) => p.id === 'pdi');
test.skip(!seed, 'Documentos privados ausentes: execute pnpm --filter backend previa-local para verificar a carga real.');

test.beforeEach(async ({ page }) => {
  await page.unroute('**/__dev/planning/workspace');
});

test('carga real local preenche todos os eixos', async ({ page }) => {
  const response = await page.request.get('/__dev/planning/workspace');
  expect(response.ok()).toBeTruthy();
  const loaded = await response.json();
  expect(loaded.localPreview.revision).toBe(seed.localPreview.revision);
  expect(loaded.localPreview.counts).toEqual(seed.localPreview.counts);
  await page.goto('/#/plano/pdi');
  await expect(page.locator('.pdi-axis-card')).toHaveCount(8);
  for (const axis of plan.axes) {
    await page.goto(`/#/plano/pdi/eixo/${axis.id}`);
    await expect(page.locator('.pdi-initiative-link')).toHaveCount(plan.items.filter((item) => item.axisId === axis.id).length);
  }
});

test('etapa importada aceita atualização, persiste e mantém os riscos na ação', async ({ page }) => {
  const item = plan.items.find((i) => i.code === '2.3.6');
  const action = item.actions.find((a) => a.tasks.some((stage) => stage.status === 'in_progress'));
  const stage = action.tasks.find((s) => s.status === 'in_progress');
  await page.goto(`/#${itemUrl(plan, item, 'acao', undefined, action.id)}`);
  await expect(page.locator('.task-row')).toHaveCount(action.tasks.length);
  await chooseOption(page, `Situação de ${stage.title}`, 'Concluída');
  await expect.poll(async () => page.evaluate(({ itemId, stageId }) => {
    const data = JSON.parse(localStorage.getItem('sumi.frontend.workspace.v2'));
    return data?.plans.find((p) => p.id === 'pdi').items.find((i) => i.id === itemId).actions.flatMap((a) => a.tasks).find((s) => s.id === stageId).status;
  }, { itemId: item.id, stageId: stage.id })).toBe('completed');
  await page.reload();
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('sumi.frontend.workspace.v2')));
  expect(saved.plans[0].items.find((i) => i.id === item.id).actions.find((a) => a.id === action.id).tasks.find((s) => s.id === stage.id).status).toBe('completed');
  await page.goto(`/#${itemUrl(plan, item, 'riscos', undefined, action.id)}`);
  await expect(page.locator('.risk-card')).toHaveCount(item.risks.filter((r) => r.actionId === action.id).length);
});

test('cache anterior recebe a carga, preserva edições e guarda cópia de segurança', async ({ page }) => {
  const previous = initialState();
  previous.plans[1].name = 'PLS personalizado';
  previous.plans[0].items[0].description = 'Anotação local já existente';
  await page.addInitScript((data) => {
    if (!localStorage.getItem('sumi.frontend.workspace.v2')) localStorage.setItem('sumi.frontend.workspace.v2', JSON.stringify(data));
  }, previous);
  await page.goto('/#/plano/pdi');
  await expect(page.locator('.pdi-axis-card')).toHaveCount(8);
  const stored = await page.evaluate(() => ({ data: JSON.parse(localStorage.getItem('sumi.frontend.workspace.v2')), backup: JSON.parse(localStorage.getItem('sumi.frontend.workspace.v2.backup.before-local-preview')) }));
  expect(stored.data.plans[0].items).toHaveLength(plan.items.length);
  expect(stored.data.plans[1].name).toBe('PLS personalizado');
  expect(stored.data.plans[0].items.find((i) => i.id === 'riscos').description).toBe('Anotação local já existente');
  expect(stored.backup).toEqual(previous);
});
