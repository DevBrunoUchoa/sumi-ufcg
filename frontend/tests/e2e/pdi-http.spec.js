import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { test, expect, chooseOption } from './fixtures.js';
import { initialState } from '../../src/data.js';
import { developmentSessions } from '../../dev/session-fixtures.js';

test.beforeEach(async ({ page }) => {
  // This contract test covers SUMI, not the external translation service.
  await page.route('https://vlibras.gov.br/app/vlibras-plugin.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.VLibras = { Widget: class {} };' }));
});

function serverWorkspace() {
  const workspace = initialState();
  const ids = new Map();
  const uuid = (id) => { if (!ids.has(id)) ids.set(id, randomUUID()); return ids.get(id); };
  const plan = workspace.plans[0];
  plan.id = uuid(plan.id);
  for (const axis of plan.axes) axis.id = uuid(axis.id);
  for (const objective of plan.objectives) { objective.id = uuid(objective.id); objective.axisId = uuid(objective.axisId); }
  for (const item of plan.items) {
    item.id = uuid(item.id); item.axisId = uuid(item.axisId); item.objectiveId = uuid(item.objectiveId);
    for (const action of item.actions) { action.id = uuid(action.id); for (const task of action.tasks) task.id = uuid(task.id); }
    for (const risk of item.risks) { risk.id = uuid(risk.id); risk.actionId = uuid(risk.actionId); }
  }
  return workspace;
}

test('navegação com workspace HTTP não grava dados; atualização de etapa salva e recarrega', async ({ page }) => {
  let workspace = serverWorkspace();
  const plan = workspace.plans[0];
  const item = plan.items[0];
  let writes = 0;
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: developmentSessions.administrator }));
  await page.route('**/api/v1/planning/itens/*/anexos', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/planning/workspace', async (route) => {
    if (route.request().method() === 'PUT') { writes += 1; workspace = route.request().postDataJSON(); }
    await route.fulfill({ json: workspace });
  });
  await page.goto(`/#/plano/${plan.id}`);
  await page.getByRole('link', { name: /Explorar eixo 8/ }).click();
  await page.locator('.pdi-initiative-link').filter({ hasText: '8.1.3' }).click();
  await page.locator('.action-overview-link').first().click();
  await expect(page.locator('.task-row')).toHaveCount(5);
  expect(writes).toBe(0);
  await chooseOption(page, 'Situação de Encaminhar para aprovação', 'Concluída');
  await expect.poll(() => writes).toBe(1);
  expect(workspace.plans[0].items[0].actions[0].tasks[3].status).toBe('completed');
  expect(workspace.plans[0].items[0].axisId).toBe(item.axisId);
  await page.reload();
  await expect(page.locator('.execution-summary strong')).toHaveText('60%');
  await page.getByRole('button', { name: /Riscos da ação/ }).click();
  await expect(page.locator('.risk-card')).toHaveCount(1);
  expect(writes).toBe(1);
});

test('importação continua usando o plano e atualiza o conteúdo da página do eixo', async ({ page }) => {
  let workspace = serverWorkspace();
  const plan = workspace.plans[0];
  const axis = plan.axes[7];
  let importedPlan;
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: developmentSessions.administrator }));
  await page.route('**/api/v1/planning/workspace', (route) => route.fulfill({ json: workspace }));
  await page.route('**/api/v1/planning/planos/*/importacao', async (route) => {
    importedPlan = route.request().url().split('/planos/')[1].split('/')[0];
    expect(route.request().method()).toBe('POST');
    expect(route.request().postData()).toContain('monitoramento.xlsx');
    workspace.plans[0].items.push({ ...structuredClone(plan.items[0]), id: randomUUID(), code: '8.1.99', title: 'Iniciativa importada', actions: [], risks: [] });
    await route.fulfill({ json: { itensCriados: 1, itensAtualizados: 0, riscosImportados: 0 } });
  });
  await page.goto(`/#/plano/${plan.id}/eixo/${axis.id}`);
  await page.getByLabel('Selecionar planilha para importar').setInputFiles({ name: 'monitoramento.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('arquivo interceptado pelo teste') });
  await expect(page.locator('.pdi-initiative-link')).toHaveCount(4);
  await expect(page.locator('.pdi-workspace')).toContainText('Iniciativa importada');
  expect(importedPlan).toBe(plan.id);
});
