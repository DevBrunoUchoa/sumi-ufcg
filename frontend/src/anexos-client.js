// Cliente HTTP para anexos (documentos de execução e comprovação de
// resultado). Fora do ciclo de save do planning-client.js de propósito —
// upload é multipart, não faz sentido caber no PUT do workspace inteiro.
const env = import.meta.env || {};
const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Falha na requisição (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

export const listarAnexos = (itemId) => request(`/api/v1/planning/itens/${itemId}/anexos`);

export function enviarAnexo(itemId, arquivo, { etapaId, resultadoId } = {}) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (etapaId) formData.append('etapaId', etapaId);
  if (resultadoId) formData.append('resultadoId', resultadoId);
  return request(`/api/v1/planning/itens/${itemId}/anexos`, { method: 'POST', body: formData });
}

export const obterUrlAnexo = (anexoId) => request(`/api/v1/planning/anexos/${anexoId}/url`);
export const removerAnexo = (anexoId) => request(`/api/v1/planning/anexos/${anexoId}`, { method: 'DELETE' });
