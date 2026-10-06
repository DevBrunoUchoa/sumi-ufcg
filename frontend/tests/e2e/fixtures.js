import { test as base, expect } from '@playwright/test';
import { initialState } from '../../src/data.js';

export const test = base.extend({
  page: async ({ page }, use) => {
    // Cada regressão define seu perfil, independente da sessão inicial pública.
    await page.context().addCookies([{ name: 'sumi_dev_session', value: 'administrator', url: 'http://127.0.0.1:4317' }]);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    // Regressões usam a base pública estável, independente dos documentos privados.
    await page.route('**/__dev/planning/workspace', (route) => route.fulfill({ json: initialState() }));
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
  await page.getByRole('button', { name: new RegExp(`Abrir ${shortName}`) }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`^${shortName}`) })).toBeVisible();
}

export async function openPdi(page) {
  await openPlan(page, 'PDI');
  await page.getByRole('link', { name: 'Explorar eixo 8: Governança e Gestão Institucional' }).click();
  await page.locator('.pdi-initiative-link').filter({ hasText: 'Iniciativa 8.1.3' }).click();
}
export const openPls = (page) => openPlan(page, 'PLS');
export const detail = (page) => page.getByRole('region', { name: 'Detalhe do item' });

export async function expandFirstAction(page) {
  const overview = page.locator('.action-overview-link').first();
  if (await overview.count()) await overview.click();
  const heading = page.locator('.action-card').first().locator('.action-heading');
  if (await heading.count() && await heading.getAttribute('aria-expanded') === 'false') await heading.click();
}

export async function expandTree(page) {
  const tree = page.getByRole('navigation', { name: 'Itens do planejamento' });
  for (const axis of await tree.locator('.tree-group.axis').all()) {
    if (await axis.getAttribute('aria-expanded') === 'false') await axis.click();
  }
  for (const objective of await tree.locator('.tree-group.objective').all()) {
    if (await objective.getAttribute('aria-expanded') === 'false') await objective.click();
  }
}

export async function chooseOption(scope, field, label) {
  await scope.getByLabel(field, { exact: true }).first().click();
  await scope.getByRole('option', { name: label, exact: true }).filter({ visible: true }).first().click();
}

export async function selectItem(page, code) {
  if (await page.locator('.pdi-workspace').count()) {
    await page.getByRole('navigation', { name: 'Hierarquia do planejamento' }).getByRole('link', { name: /^Eixo / }).click();
    await page.locator('.pdi-initiative-link').filter({ hasText: `Iniciativa ${code}` }).click();
    return;
  }
  await expandTree(page);
  await page.getByRole('navigation', { name: 'Itens do planejamento' }).getByRole('link', { name: new RegExp(code.replaceAll('.', '\\.')) }).click();
}

export async function recordNumber(page, value, note, year) {
  await page.getByRole('button', { name: 'Registrar resultado', exact: true }).click();
  const dialog = page.getByRole('dialog');
  if (year) await chooseOption(dialog, 'Ano do resultado', String(year));
  await dialog.getByLabel(/^Valor/).last().fill(String(value));
  await dialog.getByLabel('Justificativa / observação', { exact: true }).last().fill(note);
  await dialog.getByRole('button', { name: 'Salvar resultado', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
