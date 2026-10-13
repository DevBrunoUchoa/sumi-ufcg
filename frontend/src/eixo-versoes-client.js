// Cliente HTTP para o histórico versionado de importações por eixo
// (arquivo original retido + retrato de cobertura/riscos por período).
const env = import.meta.env || {};
const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Falha na requisição (${response.status}).`);
  }
  return response.json();
}

export const listarVersoesEixo = (eixoId) => request(`/api/v1/planning/eixos/${eixoId}/versoes`);
export const obterUrlVersaoEixo = (versaoId) => request(`/api/v1/planning/eixo-versoes/${versaoId}/url`);
