import { test, expect, chooseOption, useSession } from './fixtures.js';
import { initialState } from '../../src/data.js';

test('PDI entra pelos eixos e mantém a cadeia até os riscos da etapa', async ({ page }) => {
  await page.goto('/#/plano/pdi');
  await expect(page.locator('.pdi-axis-card')).toHaveCount(8);
  await expect(page.locator('.detail')).toHaveCount(0);
  await page.getByRole('link', { name: 'Explorar eixo 8: Governança e Gestão Institucional' }).click();
  await expect(page.locator('.pdi-objective')).toHaveCount(2);
  await expect(page.locator('.pdi-initiative-link')).toHaveCount(3);
  await page.locator('.pdi-initiative-link').filter({ hasText: 'Iniciativa 8.1.3' }).click();
  await page.locator('.action-overview-link').filter({ hasText: '8.1.3.1' }).click();
  const breadcrumb = page.getByRole('navigation', { name: 'Hierarquia do planejamento' });
  await expect(breadcrumb).toContainText('Objetivo 8.1');
  await expect(breadcrumb).toContainText('Iniciativa 8.1.3');
  await expect(breadcrumb).toContainText('Ação 8.1.3.1');
  await page.getByRole('button', { name: /Riscos da ação/ }).click();
  await expect(page.locator('.risk-card')).toHaveCount(1);
  await page.getByRole('link', { name: '← Voltar à ação' }).click();
  await page.locator('.task-row').filter({ hasText: 'Elaborar a minuta da portaria' }).getByRole('button', { name: 'Riscos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Riscos da etapa' })).toBeVisible();
  await expect(breadcrumb).toContainText('Elaborar a minuta da portaria');
  await page.reload();
  await expect(page.locator('.risk-card')).toHaveCount(1);
});

test('busca da entrada encontra o eixo pelo conteúdo e retorna aos oito eixos', async ({ page }) => {
  await page.goto('/#/plano/pdi');
  await page.getByRole('searchbox', { name: 'Buscar no PDI' }).fill('rankings');
  await expect(page.locator('.pdi-axis-card')).toHaveCount(1);
  await page.getByRole('link', { name: /Explorar eixo 8/ }).click();
  await page.getByRole('navigation', { name: 'Hierarquia do planejamento' }).getByRole('link', { name: 'PDI 2026–2030', exact: true }).click();
  await expect(page.locator('.pdi-axis-card')).toHaveCount(8);
});

test('um objetivo vazio permanece visível e a criação usa o eixo e objetivo atuais', async ({ page }) => {
  const workspace = initialState();
  workspace.plans[0].objectives.push({ id: 'objective-empty', axisId: 'pdi-axis-1', code: '1.1', title: 'Objetivo de ensino' });
  await page.route('**/__dev/planning/workspace', (route) => route.fulfill({ json: workspace }));
  await page.goto('/#/plano/pdi/eixo/pdi-axis-1?objective=objective-empty');
  await expect(page.getByRole('heading', { name: 'Objetivo de ensino' })).toBeVisible();
  await expect(page.getByText('Nenhuma iniciativa cadastrada neste objetivo.')).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar iniciativa' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Eixo', exact: true })).toHaveAttribute('value', '1 · Ensino');
  await expect(dialog.getByRole('combobox', { name: 'Objetivo', exact: true })).toHaveAttribute('value', '1.1 · Objetivo de ensino');
});

test('filtros do eixo não incluem iniciativas de outros eixos', async ({ page }) => {
  const workspace = initialState();
  workspace.plans[0].objectives.push({ id: 'objective-teaching', axisId: 'pdi-axis-1', code: '1.1', title: 'Ensino e rankings' });
  workspace.plans[0].items.push({ ...structuredClone(workspace.plans[0].items[1]), id: 'teaching-item', axisId: 'pdi-axis-1', objectiveId: 'objective-teaching', title: 'Outro ranking de ensino' });
  await page.route('**/__dev/planning/workspace', (route) => route.fulfill({ json: workspace }));
  await page.goto('/#/plano/pdi/eixo/pdi-axis-8');
  await page.getByRole('searchbox', { name: 'Buscar neste eixo' }).fill('ranking');
  await expect(page.locator('.pdi-initiative-link')).toHaveCount(1);
  await expect(page.locator('.pdi-workspace')).not.toContainText('Outro ranking de ensino');
});

test('links antigos funcionam e vínculos inválidos mostram 404', async ({ page }) => {
  await page.goto('/#/plano/pdi?item=riscos&view=riscos&action=comissao&stage=minuta');
  await expect(page.getByRole('heading', { name: 'Riscos da etapa' })).toBeVisible();
  await page.goto('/#/plano/pdi/eixo/pdi-axis-1?item=riscos');
  await expect(page.getByRole('heading', { name: 'Não encontramos essa página' })).toBeVisible();
  await page.goto('/#/plano/pdi?item=riscos&view=riscos&action=estrutura');
  await expect(page.locator('.risk-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Nenhum risco cadastrado' })).toBeVisible();
});

test('consulta pública navega pelos eixos e não abre riscos ou histórico por URL', async ({ page }) => {
  await useSession(page, 'public');
  await page.goto('/#/plano/pdi');
  await expect(page.locator('.pdi-axis-card')).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'Estrutura', exact: true })).toHaveCount(0);
  for (const url of ['/plano/pdi/eixo/pdi-axis-8?item=riscos&view=riscos&action=comissao', '/plano/pdi?item=riscos&view=historico']) {
    await page.goto(`/#${url}`);
    await expect(page.getByRole('heading', { name: 'Entre para continuar' })).toBeVisible();
    await expect(page.locator('.risk-card, .timeline')).toHaveCount(0);
  }
});

test('identificadores UUID e mudança de eixo conservam o contexto após salvar', async ({ page }) => {
  const workspace = initialState();
  const axisId = 'dd980bbd-e655-4a1b-9c90-a34085f48a2c';
  const axis = workspace.plans[0].axes[0];
  axis.id = axisId;
  workspace.plans[0].objectives.push({ id: 'f24986cb-fb3e-4050-9ea5-dc88557dab83', axisId, code: '1.1', title: 'Qualificar o ensino' });
  await page.route('**/__dev/planning/workspace', (route) => route.fulfill({ json: workspace }));
  await page.goto('/#/plano/pdi?item=rankings');
  await page.getByRole('button', { name: 'Editar informações' }).click();
  const dialog = page.getByRole('dialog');
  await chooseOption(dialog, 'Eixo', '1 · Ensino');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page).toHaveURL(new RegExp(`eixo/${axisId}\\?item=rankings`));
  await expect(page.getByRole('navigation', { name: 'Hierarquia do planejamento' })).toContainText('Objetivo 1.1');
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Hierarquia do planejamento' })).toContainText('Eixo 1 · Ensino');
  await expect(page.locator('h1')).toContainText(workspace.plans[0].items.find((item) => item.id === 'rankings').title);
});

test('entrada, eixo e riscos permanecem utilizáveis por teclado e em tela estreita', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/plano/pdi');
  await page.getByRole('link', { name: /Explorar eixo 8/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Governança e Gestão Institucional', exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.pdi-initiative-link').first().click();
  await page.locator('.action-overview-link').first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: /Riscos da ação/ })).toBeVisible();
  await page.getByRole('button', { name: /Riscos da ação/ }).click();
  await expect(page.locator('.risk-cell')).toHaveCount(25);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
