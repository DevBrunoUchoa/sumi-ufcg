import { test, expect, useSession } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.route('https://vlibras.gov.br/app/vlibras-plugin.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.VLibras = { Widget: class {} };' }));
});

async function enableDark(page) {
  await page.getByLabel('Acessibilidade', { exact: true }).click();
  await page.getByRole('button', { name: 'Tema escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Escape');
}

// Test contrast from rendered colors, including Web Component shadow controls.
async function contrast(locator) {
  return locator.evaluate((host) => {
    const element = host.shadowRoot?.querySelector('input,button') || host;
    const rgb = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = (values) => values.map((value) => value / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    let background = element;
    while (getComputedStyle(background).backgroundColor === 'rgba(0, 0, 0, 0)') background = background.parentElement || background.getRootNode().host;
    const foreground = luminance(rgb(getComputedStyle(element).color));
    const surface = luminance(rgb(getComputedStyle(background).backgroundColor));
    return (Math.max(foreground, surface) + .05) / (Math.min(foreground, surface) + .05);
  });
}

test('tema escuro funciona pelo teclado, persiste antes da aplicação carregar e pode ser desativado', async ({ page }) => {
  await useSession(page, 'public');
  await page.getByLabel('Acessibilidade', { exact: true }).click();
  await page.getByRole('button', { name: 'Tema escuro', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Tema claro', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('sumi.ui.dark-mode'))).toBe('true');
  let applicationRequest;
  await page.route('**/src/main.jsx*', (route) => { applicationRequest = route; });
  await page.reload({ waitUntil: 'commit' });
  await expect.poll(() => Boolean(applicationRequest)).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#root')).toBeEmpty();
  await applicationRequest.continue();
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.unroute('**/src/main.jsx*');
  await page.getByRole('link', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await contrast(page.getByLabel('Senha', { exact: true }))).toBeGreaterThanOrEqual(4.5);
  expect(await contrast(page.locator('.form-end br-button'))).toBeGreaterThanOrEqual(4.5);
  await page.getByLabel('Acessibilidade', { exact: true }).click();
  await page.getByRole('button', { name: 'Tema claro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('tema escuro alcança filtros, modais, ações, riscos e indicadores sem perder contraste', async ({ page }) => {
  await useSession(page, 'administrator');
  await enableDark(page);
  await page.goto('/#/plano/pdi/eixo/pdi-axis-8');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Governança');
  expect(await contrast(page.locator('br-input').first())).toBeGreaterThanOrEqual(4.5);
  await page.getByRole('combobox', { name: 'Filtrar responsável', exact: true }).click();
  await expect(page.getByRole('option', { name: 'SEPLAN', exact: true })).toBeVisible();
  expect(await contrast(page.getByRole('option', { name: 'SEPLAN', exact: true }))).toBeGreaterThanOrEqual(4.5);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Adicionar iniciativa', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await contrast(dialog.locator('br-input').first())).toBeGreaterThanOrEqual(4.5);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.goto('/#/plano/pdi?item=riscos&view=riscos&action=comissao');
  await expect(page.locator('.risk-cell')).toHaveCount(25);
  for (const level of ['low', 'moderate', 'high', 'critical']) expect(await contrast(page.locator(`.risk-cell.${level}`).first())).toBeGreaterThanOrEqual(4.5);
  await page.goto('/#/plano/pls?item=papel&view=indicadores');
  await expect(page.locator('.indicator-summary')).toBeVisible();
  expect(await contrast(page.locator('.indicator-summary strong').first())).toBeGreaterThanOrEqual(4.5);
});

test('tema escuro e alto contraste são alternativas coerentes em tela pequena', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await useSession(page, 'public');
  await enableDark(page);
  await page.getByLabel('Acessibilidade', { exact: true }).click();
  const panel = await page.locator('.sumi-accessibility-panel').boundingBox();
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: 'Alto contraste', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-alto-contraste', 'true');
  await page.getByRole('button', { name: 'Tema escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-alto-contraste');
  await expect(page.getByRole('button', { name: 'Alto contraste', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
