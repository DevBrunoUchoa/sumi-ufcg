import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { developmentAccounts } from '../../dev/local-login.js';
import { developmentSessions } from '../../dev/session-fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.route('https://vlibras.gov.br/app/vlibras-plugin.js', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.VLibras = { Widget: class {} };' }));
});

test('sessão local começa como visitante e credenciais inválidas não concedem acesso', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acompanhe os planos e seus resultados');
  await page.getByRole('link', { name: 'Entrar', exact: true }).click();
  await page.getByLabel('E-mail institucional').fill('admin@sumi.local');
  await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha inválidos.');
  expect((await (await page.request.get('/api/v1/auth/session')).json()).authenticated).toBe(false);
  const malformed = await page.request.post('/api/v1/auth/login', { data: Buffer.from('{'), headers: { 'Content-Type': 'application/json' } });
  expect(malformed.status()).toBe(400);
});

for (const account of developmentAccounts) {
  test(`login local ${account.profile} aplica o perfil, persiste e permite sair`, async ({ page }) => {
    await page.goto('/#/login?returnTo=%2Fplanejamentos');
    await page.getByLabel('E-mail institucional').fill(account.email);
    await page.getByLabel('Senha', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/#\/planejamentos$/);
    await expect(page.locator('.sumi-work')).toBeVisible();
    const role = developmentSessions[account.profile].roles[0];
    await expect(page.locator('.account-identity')).toContainText(role.name);
    const navigation = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(navigation.getByRole('link', { name: 'Modelos de plano', exact: true })).toHaveCount(account.profile === 'administrator' ? 1 : 0);
    await expect(navigation.getByRole('link', { name: 'Validações', exact: true })).toHaveCount(account.profile === 'axis_contributor' ? 0 : 1);
    await expect(navigation.getByRole('link', { name: 'Minhas pendências', exact: true })).toHaveCount(account.profile === 'axis_reviewer' ? 0 : 1);
    const cookie = (await page.context().cookies()).find((cookie) => cookie.name === 'sumi_dev_session');
    expect(cookie.httpOnly).toBe(true);
    await page.reload();
    await expect(page.locator('.account-identity')).toContainText(role.name);
    await page.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Acompanhe os planos e seus resultados');
    await expect(page.locator('.sumi-work-footer')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Portal GOV.BR', exact: true })).toBeVisible();
  });
}

test('rodapé da área logada mantém tamanho e posição em páginas curtas, longas e móveis', async ({ page }) => {
  await page.goto('/__dev/session/administrator');
  for (const [width, height, path] of [[1440, 1000, '/usuarios'], [1440, 1000, '/plano/pdi/eixo/pdi-axis-8'], [390, 844, '/usuarios'], [390, 600, '/plano/pdi/eixo/pdi-axis-8']]) {
    await page.setViewportSize({ width, height });
    await page.goto(`/#${path}`);
    const footer = page.locator('.sumi-work-footer');
    await expect(footer).toBeVisible();
    const box = await footer.boundingBox();
    expect(box.height).toBe(48);
    expect(box.y + box.height).toBe(height);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const scrolled = await footer.boundingBox();
    expect(scrolled.y).toBe(box.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(footer.getByRole('link', { name: 'Ajuda', exact: true })).toBeVisible();
    await expect(footer.getByRole('link', { name: 'Privacidade', exact: true })).toBeVisible();
    await expect(footer.locator('img')).toHaveCount(0);
  }
});
