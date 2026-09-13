import { test, expect, openPdi, useSession, selectItem } from './fixtures.js';

test('consulta pública recebe somente conteúdo publicado', async ({ page }) => {
  await useSession(page, 'public');
  await page.goto('/#/planejamentos');
  await expect(page.getByRole('button', { name: 'Novo planejamento' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Modelos de plano' })).toHaveCount(0);
  await openPdi(page);
  await expect(page.locator('.workflow-banner')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar informações' })).toHaveCount(0);
  await expect(page.locator('.stage-status-select')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Riscos/ })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Histórico' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Indicador e metas' }).click();
  await expect(page.getByRole('button', { name: 'Registrar resultado' })).toHaveCount(0);
});

test('gestor do eixo executa e envia, sem administrar a estrutura', async ({ page }) => {
  await useSession(page, 'axis_contributor');
  await expect(page.getByRole('link', { name: 'Minhas pendências' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Validações' })).toHaveCount(0);
  await openPdi(page);
  await expect(page.getByRole('button', { name: 'Estrutura', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar informações' })).toHaveCount(0);
  await expect(page.getByLabel('Situação de Elaborar a minuta da portaria')).toBeVisible();
  await expect(page.getByRole('button', { name: /Adicionar etapa/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar para validação' })).toBeVisible();
  await page.getByRole('button', { name: 'Enviar para validação' }).click();
  await expect(page.locator('.workflow-banner')).toContainText('Aguardando validação');
  await page.getByLabel('Situação de Elaborar a minuta da portaria').selectOption('completed');
  await expect(page.locator('.workflow-banner')).toContainText('Em elaboração');
});

test('escopo do gestor não libera mutações no PLS', async ({ page }) => {
  await useSession(page, 'axis_contributor');
  await page.goto('/#/plano/pls');
  await expect(page.locator('.stage-status-select')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Indicador e metas' }).click();
  await expect(page.getByRole('button', { name: 'Registrar resultado' })).toHaveCount(0);
});

test('responsável do eixo valida sem receber ações de execução', async ({ page }) => {
  await useSession(page, 'axis_reviewer');
  await expect(page.getByRole('link', { name: 'Validações' })).toBeVisible();
  await page.getByRole('link', { name: 'Validações' }).click();
  await page.getByRole('link', { name: /8\.1\.9/ }).click();
  await expect(page.locator('.stage-status-select')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Validar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Validar', exact: true }).click();
  await page.getByLabel('Observação da validação').fill('Informações conferidas.');
  await page.getByRole('button', { name: 'Confirmar validação' }).click();
  await expect(page.locator('.workflow-banner')).toContainText('Validado');
});

test('interface não expõe controles nem mensagens de protótipo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/simular perfil/i)).toHaveCount(0);
  await expect(page.getByText(/restaurar demonstração/i)).toHaveCount(0);
  await expect(page.getByText(/dados demonstrativos/i)).toHaveCount(0);
  await openPdi(page);
  await selectItem(page, '8.1.3');
  await expect(page.getByText(/sem backend/i)).toHaveCount(0);
});
