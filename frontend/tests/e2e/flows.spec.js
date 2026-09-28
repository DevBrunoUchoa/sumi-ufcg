import { test, expect, chooseOption, openPdi, openPls, detail, recordNumber, selectItem, expandFirstAction, expandTree } from './fixtures.js';

test('visão geral e lista permitem localizar e abrir os planos', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Olá, Usuário/ })).toBeVisible();
  await page.getByRole('link', { name: 'Planejamentos', exact: true }).click();
  await expect(page.locator('.plan-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'PLS', exact: true }).click();
  await expect(page.locator('.plan-card')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Buscar planejamento' }).fill('logistica');
  await page.getByRole('button', { name: /Abrir PLS/ }).click();
  await expect(page.getByRole('heading', { name: /^PLS/ })).toBeVisible();
});

test('menus e ações iniciam recolhidos em cada entrada', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('.sidebar')).toHaveCSS('width', '72px');
  await expect(page.getByRole('link', { name: 'Planejamentos', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expandir menu lateral' }).click();
  await expect(page.locator('.sidebar')).toHaveCSS('width', '224px');
  await page.reload();
  await expect(page.locator('.app-shell')).toHaveClass(/sidebar-collapsed/);
  await openPdi(page);
  await expect(page.locator('.tree-group.axis').first()).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.action-heading').first()).toHaveAttribute('aria-expanded', 'false');
});

test('PDI calcula o indicador por etapas e mantém o histórico', async ({ page }) => {
  await openPdi(page);
  await expandFirstAction(page);
  await expect(page.locator('.execution-summary strong')).toHaveText('20%');
  await chooseOption(page, 'Situação de Elaborar a minuta da portaria', 'Concluída');
  await expect(page.locator('.execution-summary strong')).toHaveText('30%');
  await page.getByRole('tab', { name: 'Indicador e metas' }).click();
  await expect(page.locator('.current-result strong')).toContainText('30');
  await page.getByRole('tab', { name: 'Histórico' }).click();
  await expect(page.locator('.timeline')).toContainText('alterada para Concluída');
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.locator('.timeline')).toContainText('alterada para Concluída');
});

test('PDI registra resultado numérico sem confundir meta com execução', async ({ page }) => {
  await openPdi(page);
  await selectItem(page, '8.1.9');
  await recordNumber(page, 4, 'Quatro rankings confirmados no período.', 2026);
  await expect(page.locator('.current-result')).toContainText('Meta atingida');
  await expect(page.locator('.current-result strong')).toContainText('4');
  await expect(page.locator('.measurements')).toContainText('Quatro rankings confirmados');
});

test('PLS acompanha entregas por situação descritiva', async ({ page }) => {
  await openPls(page);
  await selectItem(page, '11.1');
  await page.getByRole('tab', { name: 'Indicador e metas' }).click();
  await expect(page.locator('.current-result strong')).toContainText('Em elaboração');
  await expect(page.locator('.current-result')).not.toContainText('0%');
  await page.getByRole('button', { name: 'Registrar resultado', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await chooseOption(dialog, 'Situação da entrega', 'Concluída');
  await dialog.getByLabel('Justificativa / observação').last().fill('Guia publicado e validado pela unidade responsável.');
  await dialog.getByRole('button', { name: 'Salvar resultado' }).click();
  await expect(page.locator('.current-result strong')).toContainText('Concluída');
  await expect(page.locator('.current-result')).toContainText('Meta atingida');
});

test('busca e filtros atuam sobre eixo, objetivo, item e responsável', async ({ page }) => {
  await openPdi(page);
  const tree = page.getByRole('navigation', { name: 'Itens do planejamento' });
  await page.getByRole('searchbox', { name: 'Buscar no plano' }).fill('rankings');
  await expandTree(page);
  await expect(tree.getByRole('link')).toHaveCount(1);
  await expect(detail(page).getByRole('heading', { level: 2 })).toContainText('rankings');
  await chooseOption(page, 'Filtrar situação', 'Concluída');
  await expect(page.getByRole('heading', { name: 'Nenhum item encontrado' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expandTree(page);
  await expect(tree.getByRole('link')).toHaveCount(3);
});

test('ações aceitam novas etapas com prazo e parceiros', async ({ page }) => {
  await openPdi(page);
  await expandFirstAction(page);
  const action = page.locator('.action-card').first();
  await action.getByRole('button', { name: /Adicionar etapa/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome da etapa').fill('Revisar contribuições dos setores');
  await dialog.getByLabel('Prazo da etapa').locator('input').first().fill('30/11/2026');
  await dialog.getByLabel('Parceiros').fill('STI e Reitoria');
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(action).toContainText('Revisar contribuições dos setores');
  await expect(action).toContainText('Parceiros: STI e Reitoria');
});

test('cancelar a edição da justificativa preserva a situação da etapa', async ({ page }) => {
  await openPdi(page);
  await expandFirstAction(page);
  const stage = page.locator('.task-row').filter({ hasText: 'Encaminhar para aprovação' });
  const status = stage.getByLabel('Situação de Encaminhar para aprovação');
  const progress = page.locator('.execution-summary strong');
  const originalProgress = await progress.textContent();

  await chooseOption(stage, 'Situação de Encaminhar para aprovação', 'Cancelada');
  await expect(stage.getByRole('button', { name: 'Confirmar cancelamento' })).toBeVisible();
  await expect(progress).toHaveText(originalProgress);
  await stage.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(stage.locator('.justification-form')).toHaveCount(0);
  await expect(status.getByRole('textbox')).toHaveValue('Não iniciada');
  await expect(progress).toHaveText(originalProgress);

  await chooseOption(stage, 'Situação de Encaminhar para aprovação', 'Cancelada');
  await stage.getByLabel('Justificativa do cancelamento').fill('Etapa substituída por outro fluxo.');
  await stage.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(status.getByRole('textbox')).toHaveValue('Cancelada');
  await expect(stage).toContainText('Etapa substituída por outro fluxo.');
  await expect(page.locator('.execution-count')).toContainText('2 de 9 etapas ativas');
  await stage.getByRole('button', { name: 'Ver justificativa' }).click();
  const justificationDialog = page.getByRole('dialog');
  await justificationDialog.getByRole('button', { name: 'Editar justificativa' }).click();
  await justificationDialog.getByLabel('Justificativa da etapa').fill('Texto descartado.');
  await justificationDialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(stage).not.toContainText('Texto descartado.');
  await stage.getByRole('button', { name: 'Ver justificativa' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Editar justificativa' }).click();
  await page.getByRole('dialog').getByLabel('Justificativa da etapa').fill('Texto atualizado.');
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar justificativa' }).click();
  await stage.getByRole('button', { name: 'Ver justificativa' }).click();
  await expect(page.getByRole('dialog')).toContainText('Texto atualizado.');
});

test('abas oferecem navegação por teclado', async ({ page }) => {
  await openPdi(page);
  await page.getByRole('tab', { name: 'Ações e etapas' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Indicador e metas' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Histórico' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Ações e etapas' })).toHaveAttribute('aria-selected', 'true');
});

test('matriz de riscos filtra e detalha os registros', async ({ page }) => {
  await openPdi(page);
  await page.getByRole('tab', { name: /Riscos/ }).click();
  await expect(page.locator('.risk-cell')).toHaveCount(25);
  await page.getByRole('button', { name: /Probabilidade 3, impacto 3/ }).click();
  await expect(page.locator('.risk-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Detalhar' }).click();
  await expect(page.locator('.risk-card')).toContainText('Dependência de informações');
  await expect(page.locator('.risk-card')).toContainText('Responsável:');
});

test('tabela e evolução mantêm o período selecionado e distinguem ausência de resultado', async ({ page }) => {
  await openPdi(page);
  await page.getByRole('tab', { name: 'Indicador e metas' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: 'Selecionar 2027', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Ano de referência' })).toHaveAttribute('value', '2027');
  await expect(page.locator('.current-result')).toContainText('Sem resultado');
  await page.getByRole('button', { name: 'Evolução', exact: true }).click();
  const evolution = page.getByRole('region', { name: 'Evolução anual do atingimento' });
  await expect(evolution).toBeVisible();
  await expect(evolution.getByRole('button', { name: 'Selecionar 2027: Sem resultado', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(evolution.getByRole('button', { name: 'Selecionar 2028: Sem meta definida', exact: true })).toBeVisible();
  await evolution.getByRole('button', { name: 'Selecionar 2026: 25% de atingimento', exact: true }).click();
  await expect(page.locator('.current-result strong')).toHaveText('20 %');
  await page.getByRole('button', { name: 'Tabela', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Selecionar 2026', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Ano de referência' })).toHaveAttribute('value', '2026');
});

test('novo resumo mantém o sentido de redução e a unidade das metas do PLS', async ({ page }) => {
  await openPls(page);
  await page.getByRole('tab', { name: 'Indicador e metas' }).click();
  await expect(page.getByRole('region', { name: 'Indicador e metas', exact: true })).toContainText('Quanto menor, melhor');
  await expect(page.locator('.indicator-summary')).toContainText('≤ 900 resmas');
  await expect(page.getByRole('columnheader', { name: 'Meta (resmas)', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Evolução', exact: true }).click();
  await selectItem(page, '11.1');
  await page.getByRole('tab', { name: 'Indicador e metas' }).click();
  await expect(page.locator('.current-result')).toContainText('Em elaboração');
  await expect(page.getByRole('button', { name: 'Evolução', exact: true })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Atingimento', exact: true })).toHaveCount(0);
});
