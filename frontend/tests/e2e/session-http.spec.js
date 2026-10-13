import { test, expect } from '@playwright/test';
import { initialState } from '../../src/data.js';
import { developmentSessions } from '../../dev/session-fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.route('https://vlibras.gov.br/app/vlibras-plugin.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.VLibras = { Widget: class {} };' }));
});

test('login atualiza o workspace privado, logout volta ao público, sem PUT de reidratação', async ({ page }) => {
  let authenticated = false;
  let writes = 0;
  let allowLogin = false;
  const publicWorkspace = initialState();
  const privateWorkspace = structuredClone(publicWorkspace);
  privateWorkspace.plans.push({ ...structuredClone(privateWorkspace.plans[0]), id: 'plano-interno', shortName: 'INTERNO', name: 'Plano restrito ao gestor', status: 'draft' });
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: authenticated ? developmentSessions.administrator : developmentSessions.public }));
  await page.route('**/api/v1/auth/login', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ email: 'gestor@example.org', senha: 'senha-de-teste' });
    if (!allowLogin) return route.fulfill({ status: 401, json: { error: 'invalid_credentials' } });
    authenticated = true;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/v1/auth/logout', async (route) => {
    expect(route.request().method()).toBe('POST');
    authenticated = false;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route('**/api/v1/planning/workspace', async (route) => {
    if (route.request().method() === 'PUT') writes += 1;
    await route.fulfill({ json: authenticated ? privateWorkspace : publicWorkspace });
  });
  await page.goto('/#/planejamentos');
  await expect(page.locator('.plan-card')).toHaveCount(2);
  await page.goto('/#/login?returnTo=%2Fplanejamentos');
  await page.getByLabel('E-mail institucional').fill('gestor@example.org');
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
  allowLogin = true;
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/#\/planejamentos$/);
  await expect(page.locator('.plan-card')).toHaveCount(3);
  await expect(page.locator('.plan-card')).toContainText(['PDI', 'PLS', 'INTERNO']);
  await expect(page.locator('.sumi-menu')).toBeVisible();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acompanhe os planos e seus resultados');
  await expect(page.locator('.public-plan-card')).toHaveCount(2);
  await expect(page.getByText('Plano restrito ao gestor')).toHaveCount(0);
  await expect(page.locator('.sumi-menu, .account-summary')).toHaveCount(0);
  expect(writes).toBe(0);
});

test('falha do workspace mantém cabeçalho e rodapé, permite login e recuperação', async ({ page }) => {
  let unavailable = true;
  await page.route('**/api/v1/auth/session', (route) => route.fulfill({ json: developmentSessions.public }));
  await page.route('**/api/v1/planning/workspace', (route) => route.fulfill(unavailable ? { status: 500, json: { error: 'unavailable' } } : { json: initialState() }));
  await page.goto('/#/inicio');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Algo deu errado do nosso lado');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  await page.getByRole('link', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acesso ao sistema');
  await expect(page.getByLabel('E-mail institucional')).toBeVisible();
  await page.getByRole('link', { name: 'SUMI início', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Algo deu errado do nosso lado');
  unavailable = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('.public-plan-card')).toHaveCount(2);
});
