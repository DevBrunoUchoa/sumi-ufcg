import { test, expect, openPdi } from './fixtures.js';

test('árvore do eixo abre pelo cabeçalho, ocupa o lugar do menu e lembra a escolha', async ({ page }) => {
  await openPdi(page);
  await page.getByRole('button', { name: 'Abrir navegação do eixo' }).click();
  const tree = page.getByRole('complementary', { name: 'Navegação do eixo' });
  await expect(tree.getByRole('heading', { name: 'Eixo 8' })).toBeVisible();
  // O caminho até a iniciativa aberta já vem expandido.
  await expect(tree.getByRole('link', { name: /Iniciativa 8\.1\.3/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.sumi-menu')).toHaveCount(0);

  await page.reload();
  await expect(tree).toBeVisible();

  await tree.getByRole('button', { name: 'Fechar navegação do eixo' }).click();
  await expect(page.locator('.context-tree')).toHaveCount(0);
  await expect(page.locator('.sumi-menu')).toBeVisible();
  await page.reload();
  await expect(page.locator('.sumi-menu')).toBeVisible();
  await expect(page.locator('.context-tree')).toHaveCount(0);
});

test('em tela estreita a árvore abre como diálogo e fecha com Esc', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await openPdi(page);
  const toggle = page.getByRole('button', { name: 'Abrir navegação do eixo' });
  await toggle.click();
  const tree = page.getByRole('dialog', { name: 'Navegação do eixo' });
  await expect(tree.getByRole('button', { name: 'Fechar navegação do eixo' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tree).toHaveCount(0);
  await expect(toggle).toBeFocused();
});
