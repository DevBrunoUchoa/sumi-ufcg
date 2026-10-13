import { test, expect, useSession, openPdi } from './fixtures.js';
import { initialState } from '../../src/data.js';

test('consulta pública visualiza anexos publicados sem controles de envio ou histórico interno', async ({ page }) => {
  const item = initialState().plans[0].items[0];
  await page.route('**/api/v1/planning/itens/*/anexos', route => route.fulfill({ json: [{ id: 'file-1', etapaId: item.actions[0].tasks[0].id, nomeArquivo: 'Comprovante público.pdf', tamanhoBytes: 1024, enviadoPor: 'Equipe', enviadoEm: '2026-10-12T12:00:00Z' }] }));
  await useSession(page, 'public');
  await page.goto('/#/plano/pdi/eixo/pdi-axis-8');
  await expect(page.locator('.axis-version-history')).toHaveCount(0);
  await openPdi(page);
  await page.locator('.action-overview-link').first().click();
  await expect(page.getByRole('button', { name: /Comprovante público.pdf/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anexar documento' })).toHaveCount(0);
});

test('responsável consulta histórico no próprio eixo e pode anexar sem editar execução', async ({ page }) => {
  await page.route('**/api/v1/planning/eixos/*/versoes', route => route.fulfill({ json: [{ id: 'v1', periodo: 2026, arquivoNome: 'Monitoramento.xlsx', arquivoTamanhoBytes: 2048, coberturaExecucaoPercentual: 50, riscosTotal: 2, itensCriados: 1, itensAtualizados: 3, enviadoPor: 'Equipe', enviadoEm: '2026-10-12T12:00:00Z' }] }));
  await useSession(page, 'axis_reviewer');
  await page.goto('/#/plano/pdi/eixo/pdi-axis-8');
  const history = page.locator('.axis-version-history');
  await expect(history.locator('summary')).toContainText('Histórico de versões do eixo');
  await history.locator('summary').click();
  await expect(history.getByRole('button', { name: /Monitoramento.xlsx/ })).toBeVisible();
  await page.goto('/#/plano/pdi/eixo/pdi-axis-1');
  await expect(page.locator('.axis-version-history')).toHaveCount(0);
  await openPdi(page);
  await page.locator('.action-overview-link').first().click();
  await expect(page.getByRole('button', { name: 'Anexar documento' }).first()).toBeVisible();
  await expect(page.locator('.stage-status-select')).toHaveCount(0);
});
