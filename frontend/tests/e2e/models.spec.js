import { test, expect } from './fixtures.js';

test('administrador cria plano vazio, estrutura e primeiro item', async ({ page }) => {
  await page.goto('/#/planejamentos');
  await page.getByRole('button', { name: 'Novo planejamento' }).click();
  const planDialog = page.getByRole('dialog');
  await planDialog.getByLabel('Modelo').selectOption('pdi');
  await planDialog.getByLabel('Nome do planejamento').fill('Plano de Gestão do Centro');
  await planDialog.getByLabel('Sigla').fill('PGC');
  await planDialog.getByRole('button', { name: 'Criar planejamento' }).click();
  await expect(page.getByRole('heading', { name: /^PGC/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estrutura pronta para receber conteúdo' })).toBeVisible();

  await page.getByRole('button', { name: 'Estrutura', exact: true }).click();
  const structure = page.getByRole('dialog');
  await structure.getByRole('button', { name: 'Adicionar eixo' }).click();
  await structure.getByLabel('Código do eixo').fill('1');
  await structure.getByLabel('Nome do eixo').fill('Desenvolvimento institucional');
  await structure.getByLabel('Unidade responsável pelo eixo').fill('SEPLAN');
  await structure.getByRole('button', { name: 'Adicionar objetivo' }).click();
  await structure.getByLabel('Código do objetivo').fill('1.1');
  await structure.getByLabel('Nome do objetivo').fill('Qualificar o acompanhamento');
  await structure.getByRole('button', { name: 'Salvar estrutura' }).click();

  await page.getByRole('button', { name: 'Adicionar iniciativa' }).click();
  const item = page.getByRole('dialog');
  await item.getByLabel('Código').fill('1.1.1');
  await item.getByLabel('Título').fill('Consolidar relatórios institucionais');
  await item.getByLabel('Descrição').fill('Consolidação periódica dos relatórios das unidades.');
  await item.getByLabel('Unidade responsável').fill('SEPLAN');
  await item.getByLabel('Nome do indicador').fill('Relatórios entregues');
  await item.getByLabel('Unidade', { exact: true }).fill('relatórios');
  await item.getByLabel('Linha de base').fill('0');
  await item.getByLabel('Valor esperado').fill('4');
  await item.getByRole('button', { name: 'Adicionar ao plano' }).click();
  await expect(page.locator('.item-code')).toContainText('Iniciativa 1.1.1');
  await expect(page.getByRole('heading', { name: 'Consolidar relatórios institucionais' })).toBeVisible();
});

test('modelos permitem terminologia e campos adicionais sem alterar planos existentes', async ({ page }) => {
  await page.goto('/#/modelos');
  const pdiCard = page.locator('.model-card').filter({ hasText: 'Desenvolvimento institucional' });
  await pdiCard.getByRole('button', { name: 'Editar modelo' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Item acompanhado').fill('Entrega');
  await dialog.getByRole('button', { name: 'Adicionar campo' }).click();
  await dialog.getByLabel('Nome do campo 1').fill('Campus');
  await dialog.getByLabel('Tipo do campo 1').selectOption('select');
  await dialog.getByLabel('Opções do campo 1').fill('Campina Grande, Patos, Cajazeiras');
  await dialog.getByRole('button', { name: 'Salvar modelo' }).click();
  await expect(pdiCard).toContainText('Versão 3');
  await expect(pdiCard).toContainText('Entrega');
  await page.goto('/#/plano/pdi');
  await expect(page.locator('.item-code').first()).toContainText('Iniciativa');
});

test('criação oferece acompanhamento numérico, entrega e cálculo pelas etapas', async ({ page }) => {
  await page.goto('/#/plano/pls');
  await page.getByRole('button', { name: 'Adicionar meta' }).click();
  const dialog = page.getByRole('dialog');
  const mode = dialog.getByLabel('Como este indicador será acompanhado?');
  await expect(mode.locator('option')).toHaveText(['Informando um valor', 'Acompanhando uma entrega', 'Calculando pelas etapas']);
  await mode.selectOption('delivery');
  await expect(dialog.getByLabel('Situação esperada')).toBeVisible();
  await mode.selectOption('stages');
  await expect(dialog.getByLabel('Meta de conclusão (%)')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
});
