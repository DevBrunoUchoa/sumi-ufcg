const env = import.meta.env || {};
const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function parseErro(response, fallback) {
  const body = await response.json().catch(() => null);
  return new Error(body?.error || fallback);
}

export async function solicitarRedefinicaoSenha(email) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/esqueci-senha`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw await parseErro(response, 'Não foi possível concluir o pedido. Tente novamente.');
}

export async function redefinirSenha(token, novaSenha) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/redefinir-senha`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token, novaSenha }),
  });
  if (!response.ok) throw await parseErro(response, 'Não foi possível redefinir a senha. O link pode ter expirado.');
}
