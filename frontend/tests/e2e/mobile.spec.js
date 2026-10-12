import { test, expect, openPls, selectItem } from './fixtures.js';

test('consulta e acompanhamento permanecem utilizáveis em tela estreita', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: page.viewportSize().width < 992 ? 'Expandir menu lateral' : 'Recolher menu lateral' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (page.viewportSize().width <= 640) {
    await expect(page.locator('.sumi-menu')).toHaveCount(0);
    const main = await page.locator('#main-content').boundingBox();
    expect(main.y).toBeLessThan(150);
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
