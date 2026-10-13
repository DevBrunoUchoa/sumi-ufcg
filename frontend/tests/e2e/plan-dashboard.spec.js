import { test, expect, chooseOption, useSession } from './fixtures.js';

test('entrada apresenta eixos; painel aprofunda o escopo e preserva ano e links', async ({ page }) => {
  await page.goto('/#/plano/pdi');
  await expect(page.locator('.pdi-axis-card')).toHaveCount(8);
  await expect(page.locator('.scope-dashboard')).toHaveCount(0);
  await page.getByRole('link', { name: 'Painel de acompanhamento', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Painel de acompanhamento');
  await chooseOption(page, 'Ano das metas', '2027');
  await page.getByRole('region', { name: 'Execução por eixo', exact: true }).getByRole('link', { name: '8 · Governança e Gestão Institucional', exact: true }).click();
  await expect(page).toHaveURL(/axis=pdi-axis-8&period=2027/);
  await expect(page.getByRole('heading', { name: 'Execução por objetivo', exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Execução por objetivo', exact: true }).getByRole('link', { name: /^8\.1 · / }).click();
  await expect(page.getByRole('heading', { name: 'Execução por iniciativa', exact: true })).toBeVisible();
  await expect(page.locator('.dashboard-scope')).toContainText('2 iniciativas');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Metas e resultados · 2027' })).toBeVisible();
  await page.getByRole('link', { name: 'Explorar objetivo', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aperfeiçoar Práticas de Governança Pública');
  await expect(page).toHaveURL(/period=2027/);
  await expect(page.getByRole('heading', { name: 'Situação das metas · 2027', exact: true })).toBeVisible();
});

test('itens sem resultado abrem lista filtrada; visitante não recebe validações', async ({ page }) => {
  await useSession(page, 'public');
  await page.goto('/#/plano/pdi/painel?period=2027');
  await page.getByRole('link', { name: /indicadores sem resultado/ }).click();
  await expect(page).toHaveURL(/focus=missing/);
  await expect(page.locator('#dashboard-attention-title')).toBeFocused();
  await expect(page.locator('.attention-row')).toHaveCount(3);
  await expect(page.locator('.attention-row').filter({ hasText: 'Aguardando validação' })).toHaveCount(0);
  await chooseOption(page, 'Mostrar itens', 'Etapas com prazo vencido (1)');
  await expect(page.locator('.attention-row')).toHaveCount(1);
  await page.locator('.attention-row').getByRole('link', { name: 'Abrir iniciativa 8.1.3', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Elaborar o Plano de Gestão de Riscos da UFCG');
  await page.goto('/#/plano/pdi/painel?focus=review');
  await expect(page.getByRole('heading', { name: 'Entre para continuar' })).toBeVisible();
});

test('revisor vê apenas suas validações e painel cabe em tela estreita com tema escuro', async ({ page }) => {
  await useSession(page, 'axis_reviewer');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/plano/pdi/painel?axis=pdi-axis-8&focus=review');
  await expect(page.locator('.attention-row')).toHaveCount(1);
  await expect(page.locator('.attention-row')).toContainText('8.1.9');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Acessibilidade', { exact: true }).click();
  await page.getByRole('button', { name: 'Tema escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/#/plano/pdi/painel?axis=pdi-axis-1&objective=pdi-objective-8-1');
  await expect(page.getByRole('heading', { name: 'Não encontramos essa página' })).toBeVisible();
});
