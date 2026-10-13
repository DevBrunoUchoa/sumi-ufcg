import { test, expect, chooseOption, useSession } from './fixtures.js';

test('objetivo tem título, dados do seu escopo, ano das metas e retorno pela hierarquia', async ({ page }) => {
  await page.goto('/#/plano/pdi/eixo/pdi-axis-8');
  await page.getByRole('link', { name: 'Acompanhar objetivo 8.1', exact: true }).click();
  await expect(page).toHaveURL(/\/objetivo\/pdi-objective-8-1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aperfeiçoar Práticas de Governança Pública');
  await expect(page.locator('.planning-summary')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Iniciativas deste objetivo 2 iniciativas' })).toBeVisible();
  await expect(page.locator('.chart-scope-summary')).toContainText('3 de 14 etapas ativas concluídas');
  await expect(page.locator('.pdi-initiative-link')).toHaveCount(2);
  await expect(page.locator('.objective-indicators tbody tr')).toHaveCount(2);
  await expect(page.locator('.pdi-workspace')).not.toContainText('Implantar o Plano de Logística Sustentável');
  await chooseOption(page, 'Ano das metas', '2027');
  await expect(page.getByRole('heading', { name: 'Situação das metas · 2027' })).toBeVisible();
  await expect(page.locator('.objective-indicators tbody tr').first()).toContainText('2027');
  await page.getByRole('searchbox', { name: 'Buscar neste objetivo' }).fill('rankings');
  await expect(page.locator('.pdi-initiative-link')).toHaveCount(1);
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await expect(page).toHaveURL(/\/objetivo\/pdi-objective-8-1\?period=2027$/);
  await page.locator('.pdi-initiative-link').first().click();
  await expect(page.locator('.metric-trend svg')).toBeVisible();
  await page.getByRole('navigation', { name: 'Hierarquia do planejamento' }).getByRole('link', { name: 'Objetivo 8.1', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aperfeiçoar Práticas de Governança Pública');
  await page.reload();
  await expect(page.locator('.pdi-initiative-link')).toHaveCount(2);
});

test('painéis públicos oferecem dados em tabela, tema e acesso ao objetivo em tela estreita', async ({ page }) => {
  await useSession(page, 'public');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/plano/pdi/eixo/pdi-axis-8/objetivo/pdi-objective-8-1');
  await expect(page.locator('.sumi-menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar iniciativa' })).toHaveCount(0);
  await page.locator('.chart-data summary').first().click();
  await expect(page.getByRole('table', { name: 'Execução por iniciativa', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Acessibilidade', { exact: true }).click();
  await page.getByRole('button', { name: 'Tema escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.chart-bar-track > span').first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.getByRole('button', { name: 'Alto contraste', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-alto-contraste', 'true');
  await page.goto('/#/plano/pdi/eixo/pdi-axis-1/objetivo/pdi-objective-8-1');
  await expect(page.getByRole('heading', { name: 'Não encontramos essa página' })).toBeVisible();
});
