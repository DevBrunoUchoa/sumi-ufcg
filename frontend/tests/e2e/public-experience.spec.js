import { test, expect, useSession } from './fixtures.js';
import { initialState } from '../../src/data.js';

test.beforeEach(async ({ page }) => {
  await page.route('https://vlibras.gov.br/app/vlibras-plugin.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.VLibras = { Widget: class {} };' }));
});

test('sair do administrador local abre a consulta pública e preserva a saída ao recarregar', async ({ page }) => {
  await useSession(page, 'administrator');
  await expect(page.locator('.sumi-menu')).toBeVisible();
  const response = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/logout') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  expect((await response).status()).toBe(204);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acompanhe os planos e seus resultados');
  await expect(page.locator('.sumi-menu, .account-summary')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Entrar', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acompanhe os planos e seus resultados');
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toHaveCount(0);
});

test('consulta pública possui navegação institucional, rodapé e nenhuma área administrativa', async ({ page }) => {
  await useSession(page, 'public');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acompanhe os planos e seus resultados');
  await expect(page.locator('.sumi-menu, .account-summary')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Planos', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Consultar PDI', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Consultar PLS', exact: true })).toBeVisible();
  await expect(page.locator('.public-plan-facts')).toContainText(['Execução das etapas', 'Execução das etapas']);
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Portal GOV.BR' })).toBeVisible();
  expect(await footer.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await footer.getByRole('link', { name: 'Ajuda e acessibilidade' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajuda e acessibilidade');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await footer.getByRole('link', { name: 'Informações sobre privacidade' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Informações sobre privacidade');
});

test('consulta e login cabem em 320px, com acessibilidade e formulário utilizáveis', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await useSession(page, 'public');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Acessibilidade', { exact: true }).click();
  const panel = await page.locator('.sumi-accessibility-panel').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Alto contraste', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-alto-contraste', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Acessibilidade', { exact: true })).toBeFocused();
  await page.getByRole('link', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acesso ao sistema');
  await expect(page.locator('.sumi-menu')).toHaveCount(0);
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
  await page.getByRole('button', { name: 'Mostrar senha' }).click();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('link', { name: /Entrar com GOV.BR/ })).toHaveCount(0);
  await expect(page.locator('.access-intro, .access-help')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Continuar na consulta pública', exact: true })).toBeVisible();
});

test('menu da área de trabalho preserva foco, fecha por Escape e não reaparece na consulta pública', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await useSession(page, 'administrator');
  await expect(page.locator('.sumi-menu')).toHaveCount(0);
  const trigger = page.getByRole('button', { name: 'Expandir menu lateral' });
  await trigger.click();
  await expect(page.getByRole('button', { name: 'Fechar menu lateral' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.menu-footer a')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.locator('.sumi-menu')).toHaveCount(0);
  await trigger.click();
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Planos', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.locator('.sumi-menu')).toHaveCount(0);
  await useSession(page, 'public');
  await expect(page.locator('.sumi-menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /menu lateral/ })).toHaveCount(0);
});

test('sem planos publicados, a consulta orienta o visitante sem sugerir administração', async ({ page }) => {
  const workspace = initialState();
  for (const plan of workspace.plans) plan.status = 'draft';
  await page.route('**/__dev/planning/workspace', (route) => route.fulfill({ json: workspace }));
  await useSession(page, 'public');
  await expect(page.getByText('Nenhum plano publicado no momento.')).toBeVisible();
  await expect(page.locator('.public-plan-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Novo planejamento' })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Planos', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Planos institucionais');
  await expect(page.locator('.plan-card')).toHaveCount(0);
  await expect(page.getByText('Os planos aparecerão aqui quando estiverem disponíveis para consulta.')).toBeVisible();
});
