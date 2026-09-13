import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await use(page);
    expect(errors, 'Erros JavaScript no navegador').toEqual([]);
  },
});

export { expect };

export async function useSession(page, profile) {
  await page.goto(`/__dev/session/${profile}`);
  await expect(page.locator('#main-content')).toBeVisible();
}

export async function openPlan(page, shortName) {
  await page.goto('/#/planejamentos');
  await page.getByRole('link', { name: new RegExp(`Abrir ${shortName}`) }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`^${shortName}`) })).toBeVisible();
}

export const openPdi = (page) => openPlan(page, 'PDI');
export const openPls = (page) => openPlan(page, 'PLS');
export const detail = (page) => page.getByRole('region', { name: 'Detalhe do item' });

export async function selectItem(page, code) {
  await page.getByRole('navigation', { name: 'Itens do planejamento' }).getByRole('link', { name: new RegExp(code.replaceAll('.', '\\.')) }).click();
}

export async function recordNumber(page, value, note, year) {
  await page.getByRole('tab', { name: 'Indicador e metas' }).click();
  await page.getByRole('button', { name: 'Registrar resultado', exact: true }).click();
  const dialog = page.getByRole('dialog');
  if (year) await dialog.getByLabel('Ano do resultado', { exact: true }).selectOption(String(year));
  await dialog.getByLabel(/^Valor/).fill(String(value));
  await dialog.getByLabel('Justificativa / observação', { exact: true }).fill(note);
  await dialog.getByRole('button', { name: 'Salvar resultado', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
