import { test, expect } from './fixtures.js';
import { initialState } from '../../src/data.js';

test('exibe os oito ícones temáticos do PDI, inclusive em eixos vazios', async ({ page }) => {
  await page.goto('/#/plano/pdi');
  const tree = page.getByRole('navigation', { name: 'Itens do planejamento' });
  await expect(tree.locator('.tree-group.axis')).toHaveCount(8);
  await expect(tree.locator('.axis-icon')).toHaveCount(8);
  await expect(tree.getByRole('button', { name: /Eixo 1 · Ensino/ })).toBeVisible();
  await expect(tree.getByRole('button', { name: /Eixo 8 · Governança e Gestão Institucional/ })).toBeVisible();
  await tree.getByRole('button', { name: /Eixo 1 · Ensino/ }).click();
  await expect(tree.getByText('Nenhuma iniciativa cadastrada neste eixo.')).toBeVisible();

  await page.getByRole('button', { name: 'Estrutura', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Estrutura do planejamento' });
  await expect(dialog.locator('.axis-structure .axis-icon')).toHaveCount(8);
});

test('não associa símbolos temáticos do PDI aos eixos do PLS', async ({ page }) => {
  await page.goto('/#/plano/pls');
  const tree = page.getByRole('navigation', { name: 'Itens do planejamento' });
  await expect(tree.locator('.tree-group.axis')).toHaveCount(3);
  await expect(tree.locator('.axis-icon')).toHaveCount(0);
});

test('atualiza a prévia local antiga sem perder o eixo 8', async ({ page }) => {
  const oldWorkspace = initialState();
  const pdi = oldWorkspace.plans.find((plan) => plan.id === 'pdi');
  pdi.axes = pdi.axes.filter((axis) => axis.code === '8');
  pdi.axes[0].color = '#2f78a5';
  await page.addInitScript((workspace) => {
    localStorage.setItem('sumi.frontend.workspace.v2', JSON.stringify(workspace));
  }, oldWorkspace);

  await page.goto('/#/plano/pdi');
  const tree = page.getByRole('navigation', { name: 'Itens do planejamento' });
  await expect(tree.locator('.axis-icon')).toHaveCount(8);
  await expect(tree.locator('.axis-group').last()).toHaveAttribute('style', /#b5336f/);
});
