// Cliente HTTP para a administração de usuários (só o Administrador
// Estratégico tem acesso — model.manage). Atribuir alguém como Gestor/
// Responsável de um eixo continua sendo feito na estrutura do plano
// (ver StructureForm em forms.jsx), não aqui — este módulo só cria a conta.
const env = import.meta.env || {};
const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Falha na requisição (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

export const listarUsuarios = () => request('/api/v1/admin/usuarios');
export const criarUsuario = (dados) => request('/api/v1/admin/usuarios', { method: 'POST', body: JSON.stringify(dados) });
export const atualizarUsuario = (id, dados) => request(`/api/v1/admin/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(dados) });
export const removerUsuario = (id) => request(`/api/v1/admin/usuarios/${id}`, { method: 'DELETE' });
