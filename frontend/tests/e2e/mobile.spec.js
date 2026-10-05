import { test, expect, openPls, selectItem } from './fixtures.js';

test('consulta e acompanhamento permanecem utilizáveis em tela estreita', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /menu lateral/ })).toHaveCount(page.viewportSize().width <= 640 ? 0 : 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (page.viewportSize().width <= 640) {
    const account = await page.locator('.account-summary').boundingBox();
    const libras = await page.getByRole('button', { name: 'Desativar Libras' }).boundingBox();
    expect(account.y).toBeGreaterThanOrEqual(libras.y + libras.height);
  }
  await openPls(page);
  await selectItem(page, '11.1');
  await expect(page.locator('.current-result')).toContainText('Em elaboração');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Registrar resultado' }).click();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
});
