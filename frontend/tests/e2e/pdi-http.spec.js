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
  await page.getByRole('button', { name: /Gerenciamento de riscos \(/ }).click();
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

test('objetivo e gráficos usam UUIDs e a API HTTP sem gravações de navegação', async ({ page }) => {
  const workspace = serverWorkspace();
  const plan = workspace.plans[0];
  const objective = plan.objectives[0];
  let writes = 0;
  let developmentRequests = 0;
  page.on('request', (request) => { if (request.url().includes('/__dev/')) developmentRequests += 1; });
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: developmentSessions.administrator }));
  await page.route('**/api/v1/planning/workspace', (route) => {
    if (route.request().method() !== 'GET') writes += 1;
    return route.fulfill({ json: workspace });
  });
  await page.goto(`/#/plano/${plan.id}/eixo/${objective.axisId}/objetivo/${objective.id}?period=2027`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(objective.title);
  await expect(page.locator('.objective-indicators tbody tr')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Situação das metas · 2027' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Situação das metas · 2027' })).toBeVisible();
  expect(writes).toBe(0);
  expect(developmentRequests).toBe(0);
});

test('painel independente filtra dados da API e não grava o workspace', async ({ page }) => {
  const workspace = serverWorkspace();
  const plan = workspace.plans[0];
  let writes = 0;
  let developmentRequests = 0;
  page.on('request', (request) => { if (request.url().includes('/__dev/')) developmentRequests += 1; });
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: developmentSessions.public }));
  await page.route('**/api/v1/planning/workspace', (route) => {
    if (route.request().method() !== 'GET') writes += 1;
    return route.fulfill({ json: workspace });
  });
  await page.goto(`/#/plano/${plan.id}/painel?period=2027`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Painel de acompanhamento');
  await page.getByRole('region', { name: 'Execução por eixo', exact: true }).getByRole('link', { name: '8 · Governança e Gestão Institucional', exact: true }).click();
  await expect(page.locator('.dashboard-scope')).toContainText('3 iniciativas');
  await page.getByRole('link', { name: /indicadores sem resultado/ }).click();
  await expect(page.locator('.attention-row')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.attention-row')).toHaveCount(3);
  expect(writes).toBe(0);
  expect(developmentRequests).toBe(0);
});

test('estrutura permite sobrescrever e remover ODS, mantendo a escolha após recarga', async ({ page }) => {
  let workspace = initialState();
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: developmentSessions.administrator }));
  await page.route('**/api/v1/admin/usuarios', (route) => route.fulfill({ json: [] }));
  let writes = 0;
  await page.route('**/api/v1/planning/workspace', async (route) => {
    if (route.request().method() === 'PUT') { workspace = route.request().postDataJSON(); writes += 1; }
    await route.fulfill({ json: workspace });
  });
  // A Estrutura fica só no hub do plano; os ODS são conferidos na página do objetivo.
  // Os objetivos (e seus ODS) aparecem ao editar o eixo a que pertencem.
  const objectivePage = '/#/plano/pdi/eixo/pdi-axis-8/objetivo/pdi-objective-8-2';
  const openStructure = async () => {
    await page.goto('/#/plano/pdi');
    await page.getByRole('button', { name: 'Estrutura', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Editar eixo 8', exact: true }).click();
  };
  await openStructure();
  const picker = page.getByRole('dialog').locator('.ods-picker').filter({ hasText: 'ODS vinculadas ao objetivo 8.2' });
  await picker.locator('summary').click();
  await expect(picker.getByRole('checkbox', { name: /^ODS 10 ·/ })).toBeChecked();
  await picker.getByRole('checkbox', { name: /^ODS 4 ·/ }).check();
  await page.getByRole('button', { name: 'Salvar estrutura', exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await page.goto(objectivePage);
  await expect(page.locator('.objective-ods img')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('.objective-ods img')).toHaveCount(3);
  expect(workspace.plans[0].objectives.find(entry => entry.code === '8.2').ods).toEqual([4, 10, 16]);
  await openStructure();
  await picker.locator('summary').click();
  for (const number of [4, 10, 16]) await picker.getByRole('checkbox', { name: new RegExp(`^ODS ${number} ·`) }).uncheck();
  await page.getByRole('button', { name: 'Salvar estrutura', exact: true }).click();
  await expect.poll(() => writes).toBe(2);
  await page.goto(objectivePage);
  await page.reload();
  await expect(page.locator('.objective-ods')).toHaveCount(0);
  await openStructure();
  await picker.locator('summary').click();
  await picker.getByRole('button', { name: 'Aplicar vínculos documentados no PDI' }).click();
  await page.getByRole('button', { name: 'Salvar estrutura', exact: true }).click();
  await expect.poll(() => writes).toBe(3);
  await page.goto(objectivePage);
  await page.reload();
  await expect(page.locator('.objective-ods img')).toHaveCount(2);
});
