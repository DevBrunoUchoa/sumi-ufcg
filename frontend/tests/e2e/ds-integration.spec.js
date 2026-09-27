import { test, expect, openPdi } from './fixtures.js';
import { Buffer } from 'node:buffer';

test('prazo do risco editado permanece salvo', async ({ page }) => {
  await openPdi(page);
  await page.getByRole('tab', { name: /Riscos/ }).click();
  await page.locator('.risk-card').first().getByRole('button', { name: 'Editar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Prazo de conclusão').locator('input').first().fill('30/11/2026');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).not.toBeVisible();
  await page.locator('.risk-card').first().getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('dialog').getByLabel('Prazo de conclusão')).toHaveJSProperty('serializedValue', '2026-11-30');
});

test('anexo selecionado pelo componente GOV.BR inicia upload', async ({ page }) => {
  await page.route('**/api/v1/planning/itens/*/anexos', async (route) => {
    await route.fulfill({ status: route.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: route.request().method() === 'GET' ? '[]' : '{}' });
  });
  await openPdi(page);
  const uploadRequest = page.waitForRequest((request) => request.method() === 'POST' && /\/api\/v1\/planning\/itens\/[^/]+\/anexos/.test(request.url()));
  await page.locator('.action-card').first().locator('br-upload').first().locator('input[type="file"]').setInputFiles({ name: 'evidencia.txt', mimeType: 'text/plain', buffer: Buffer.from('Documento de teste') });
  const request = await uploadRequest;
  expect(request.postData()).toContain('evidencia.txt');
});
