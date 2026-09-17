// Cliente HTTP para importação/exportação de planilhas de monitoramento do
// PDI e gerenciamento de riscos. Fora do ciclo de save do planning-client.js
// de propósito (o modelo é um download simples e a importação é multipart,
// igual ao anexos-client.js) — depois de importar, quem chamou precisa
// recarregar o workspace para ver o resultado (ver reloadWorkspace em App).
const env = import.meta.env || {};
const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function baixarModeloPlanilha() {
  const url = `${API_BASE_URL}/api/v1/planning/importacao/modelo`;
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modelo-monitoramento-pdi-sumi.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function importarPlanilha(planId, arquivo) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  const response = await fetch(`${API_BASE_URL}/api/v1/planning/planos/${planId}/importacao`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Falha ao importar a planilha (${response.status}).`);
  return body;
}
