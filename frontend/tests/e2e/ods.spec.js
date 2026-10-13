import { test, expect } from './fixtures.js';
import { initialState } from '../../src/data.js';

test('ODS aparecem apenas na página do objetivo, sem repetição na tela do eixo', async ({ page }) => {
  await page.goto('/#/plano/pdi/eixo/pdi-axis-8');
  const objective = page.locator('.pdi-objective').filter({ hasText: 'OBJETIVO 8.2' });
  await expect(page.locator('.objective-ods')).toHaveCount(0);
  await objective.getByRole('button', { name: 'Recolher objetivo 8.2' }).click();
  await expect(page.locator('.objective-ods')).toHaveCount(0);
  await expect(objective.locator('.pdi-objective-content')).toBeHidden();
  await objective.getByRole('link', { name: 'Acompanhar objetivo 8.2' }).click();
  const identity = page.locator('.pdi-identity');
  await expect(identity.getByRole('heading', { name: 'Aperfeiçoar Práticas de Gestão Institucional' })).toBeVisible();
  await expect(identity.getByRole('link', { name: 'ODS 10 — Redução das desigualdades (abre em nova aba)', exact: true })).toHaveAttribute('href', 'https://brasil.un.org/pt-br/sdgs/10');
  await expect(identity.locator('.objective-ods img')).toHaveCount(2);
  await expect(page.locator('.objective-ods')).toHaveCount(1);
  await page.reload();
  await expect(identity.locator('.objective-ods img')).toHaveCount(2);
});

test('todas as 17 ODS são expansíveis por teclado e não ficam abertas ao trocar de objetivo', async ({ page }) => {
  const workspace = initialState();
  workspace.plans[0].objectives.push({ id: 'research-1', axisId: 'pdi-axis-2', code: '2.1', title: 'Fortalecer as iniciativas de inovação' });
  workspace.plans[0].objectives.push({ id: 'research-2', axisId: 'pdi-axis-2', code: '2.2', title: 'Fortalecer e consolidar programas de pós-graduação' });
  await page.route('**/__dev/planning/workspace', (route) => route.fulfill({ json: workspace }));
  await page.goto('/#/plano/pdi/eixo/pdi-axis-2/objetivo/research-1');
  const ods = page.locator('.objective-ods');
  await expect(ods.locator('img')).toHaveCount(17);
  await expect(ods.locator('img').first()).toBeHidden();
  await ods.locator('summary').press('Enter');
  await expect(ods.locator('img').last()).toBeVisible();
  await expect(ods.getByRole('link')).toHaveCount(17);
  await ods.locator('summary').press('Enter');
  await expect(ods.locator('img').last()).toBeHidden();
  await ods.locator('summary').click();
  await page.goto('/#/plano/pdi/eixo/pdi-axis-2/objetivo/research-2');
  await expect(ods.locator('img').first()).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await ods.locator('summary').click();
  await expect(ods.locator('img').last()).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});

test('ODS em tela pequena e temas mantêm imagens legíveis sem transbordar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/plano/pdi/eixo/pdi-axis-8/objetivo/pdi-objective-8-2');
  const images = page.locator('.objective-ods img');
  await expect(images.first()).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.getByLabel('Acessibilidade', { exact: true }).click();
  await page.getByRole('button', { name: 'Tema escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(images.first()).toHaveCSS('filter', 'none');
  await expect.poll(() => images.last().evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.getByRole('button', { name: /Alto contraste/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-alto-contraste', 'true');
  await expect(images.first()).toHaveCSS('filter', 'none');
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});
