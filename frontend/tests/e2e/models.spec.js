import { test, expect, chooseOption } from './fixtures.js';

test('administrador cria plano vazio, estrutura e primeiro item', async ({ page }) => {
  await page.goto('/#/planejamentos');
  await page.getByRole('button', { name: 'Novo planejamento' }).click();
  const planDialog = page.getByRole('dialog');
  await expect(planDialog.getByRole('combobox', { name: 'Modelo' })).toHaveAttribute('value', 'PDI · Desenvolvimento institucional');
  await chooseOption(planDialog, 'Modelo', 'PLS · Logística sustentável');
  await expect(planDialog.getByRole('combobox', { name: 'Modelo' })).toHaveAttribute('value', 'PLS · Logística sustentável');
  await chooseOption(planDialog, 'Modelo', 'PDI · Desenvolvimento institucional');
  await planDialog.getByLabel('Nome do planejamento').last().fill('Plano de Gestão do Centro');
  await planDialog.getByLabel('Sigla').last().fill('PGC');
  await planDialog.getByRole('button', { name: 'Criar planejamento' }).click();
  await expect(page.getByRole('heading', { name: /^PGC/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Estrutura pronta para receber conteúdo' })).toBeVisible();

  await page.getByRole('button', { name: 'Estrutura', exact: true }).click();
  const structure = page.getByRole('dialog');
  await structure.getByRole('button', { name: 'Adicionar eixo' }).click();
  await structure.getByLabel('Código do eixo').last().fill('1');
  await structure.getByLabel('Nome do eixo').last().fill('Desenvolvimento institucional');
  await structure.getByLabel('Unidade responsável pelo eixo').last().fill('SEPLAN');
  await structure.getByRole('button', { name: 'Adicionar objetivo' }).click();
  await structure.getByLabel('Código do objetivo').last().fill('1.1');
  await structure.getByLabel('Nome do objetivo').last().fill('Qualificar o acompanhamento');
  await structure.getByRole('button', { name: 'Salvar estrutura' }).click();

  await page.getByRole('button', { name: 'Adicionar iniciativa' }).click();
  const item = page.getByRole('dialog');
  await item.getByLabel('Código').last().fill('1.1.1');
  await item.getByLabel('Título').last().fill('Consolidar relatórios institucionais');
  await item.getByLabel('Descrição').last().fill('Consolidação periódica dos relatórios das unidades.');
  await item.getByLabel('Unidade responsável').last().fill('SEPLAN');
  await item.getByLabel('Nome do indicador').last().fill('Relatórios entregues');
  await item.getByLabel('Unidade', { exact: true }).last().fill('relatórios');
  await item.getByLabel('Linha de base').last().fill('0');
  await item.getByLabel('Valor esperado').last().fill('4');
  await item.getByRole('button', { name: 'Adicionar ao plano' }).click();
  await expect(page.locator('.item-code')).toContainText('Iniciativa 1.1.1');
  await expect(page.getByRole('heading', { name: 'Consolidar relatórios institucionais' })).toBeVisible();
});

test('modelos permitem terminologia e campos adicionais sem alterar planos existentes', async ({ page }) => {
  await page.goto('/#/modelos');
  const pdiCard = page.locator('.model-card').filter({ hasText: 'Desenvolvimento institucional' });
  await pdiCard.getByRole('button', { name: 'Editar modelo' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Item acompanhado').last().fill('Entrega');
  await dialog.getByRole('button', { name: 'Adicionar campo' }).click();
  await dialog.getByLabel('Nome do campo 1').last().fill('Campus');
  await chooseOption(dialog, 'Tipo do campo 1', 'Seleção');
  await dialog.getByLabel('Opções do campo 1').last().fill('Campina Grande, Patos, Cajazeiras');
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
  await expect(mode.locator('br-select-option')).toHaveCount(3);
  await chooseOption(dialog, 'Como este indicador será acompanhado?', 'Acompanhando uma entrega');
  await expect(dialog.getByRole('combobox', { name: 'Situação esperada' })).toBeVisible();
  await chooseOption(dialog, 'Como este indicador será acompanhado?', 'Calculando pelas etapas');
  await expect(dialog.getByLabel('Meta de conclusão (%)').last()).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
});
