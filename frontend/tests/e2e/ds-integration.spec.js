import { test, expect, openPdi, expandFirstAction } from './fixtures.js';
import { Buffer } from 'node:buffer';

test('prazo do risco editado permanece salvo', async ({ page }) => {
  await openPdi(page);
  await expandFirstAction(page);
  await page.getByRole('button', { name: /Riscos da ação/ }).click();
  await page.locator('.risk-card').first().getByRole('button', { name: 'Editar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Prazo de conclusão').locator('input').first().fill('30/11/2026');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog).not.toBeVisible();
  await page.locator('.risk-card').first().getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('dialog').getByLabel('Prazo de conclusão')).toHaveJSProperty('serializedValue', '2026-11-30');
});

test('janela de anexo aceita arquivo e inicia upload', async ({ page }) => {
  await page.route('**/api/v1/planning/itens/*/anexos', async (route) => {
    await route.fulfill({ status: route.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: route.request().method() === 'GET' ? '[]' : '{}' });
  });
  await openPdi(page);
  await expandFirstAction(page);
  await page.getByRole('button', { name: 'Anexar documento' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Anexar documento' });
  await expect(dialog.getByText('Tamanho máximo: 15 MB.')).toBeVisible();
  await expect(page.locator('.attachment-hint')).toHaveCount(0);
  const uploadRequest = page.waitForRequest((request) => request.method() === 'POST' && /\/api\/v1\/planning\/itens\/[^/]+\/anexos/.test(request.url()));
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'evidencia.txt', mimeType: 'text/plain', buffer: Buffer.from('Documento de teste') });
  await dialog.getByRole('button', { name: 'Enviar arquivo' }).click();
  const request = await uploadRequest;
  expect(request.postData()).toContain('evidencia.txt');
});

test('botão de anexo aparece antes da listagem e uma única consulta atende as etapas', async ({ page }) => {
  let consultas = 0;
  await page.route('**/api/v1/planning/itens/*/anexos', async (route) => {
    if (route.request().method() === 'GET') {
      consultas += 1;
      await new Promise((resolve) => setTimeout(resolve, 1400));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
  });
  await openPdi(page);
  await expandFirstAction(page);
  await expect(page.getByRole('button', { name: 'Anexar documento' }).first()).toBeVisible({ timeout: 1000 });
  await expect.poll(() => consultas).toBe(1);
  await page.waitForTimeout(1500);
  expect(consultas).toBe(1);
});

test('área de anexo aceita arrastar arquivo e rejeita formato não permitido', async ({ page }) => {
  await page.route('**/api/v1/planning/itens/*/anexos', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await openPdi(page);
  await expandFirstAction(page);
  await page.getByRole('button', { name: 'Anexar documento' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Anexar documento' });
  const dropzone = dialog.locator('.attachment-dropzone');
  await dropzone.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['conteúdo'], 'arquivo.zip', { type: 'application/zip' }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  });
  await expect(dialog.getByRole('alert')).toContainText('Formato não permitido');
  await expect(dialog.getByRole('button', { name: 'Enviar arquivo' })).toBeDisabled();
  await dropzone.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'grande.txt', { type: 'text/plain' }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  });
  await expect(dialog.getByRole('alert')).toContainText('no máximo 15 MB');
  await dropzone.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['conteúdo'], 'evidencia.txt', { type: 'text/plain' }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  });
  await expect(dialog).toContainText('evidencia.txt');
  await expect(dialog.getByRole('button', { name: 'Enviar arquivo' })).toBeEnabled();
});
