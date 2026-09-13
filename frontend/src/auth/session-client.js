import { PERMISSIONS } from './permissions.js';

const env = import.meta.env || {};
const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const SESSION_PATH = env.VITE_AUTH_SESSION_PATH || '/api/v1/auth/session';

const publicSession = () => ({
  authenticated: false,
  user: null,
  roles: [],
  grants: [{ permission: PERMISSIONS.VIEW_PUBLISHED_PLAN, scope: { type: 'global' } }],
});

const present = (value) => typeof value === 'string' && value.trim().length > 0;
const validScope = (scope) => scope?.type === 'global'
  || (scope?.type === 'plan' && present(scope.planId))
  || (scope?.type === 'axis' && present(scope.planId) && present(scope.axisId))
  || (scope?.type === 'item' && present(scope.planId) && present(scope.itemId));

export function normalizeSession(payload) {
  if (!payload || payload.authenticated !== true) return publicSession();
  if (!String(payload.user?.id || '').trim() || !String(payload.user?.name || '').trim() || !Array.isArray(payload.roles) || !Array.isArray(payload.grants)) throw new Error('Resposta de sessão inválida.');
  if (payload.roles.some((role) => !present(role?.code) || !present(role?.name)) || payload.grants.some((grant) => !present(grant?.permission) || !validScope(grant?.scope))) throw new Error('Resposta de sessão inválida.');
  if (!payload.grants.some((grant) => grant.permission === PERMISSIONS.VIEW_PUBLISHED_PLAN && grant.scope.type === 'global')) throw new Error('A sessão não preserva o acesso público global.');
  return {
    authenticated: true,
    user: {
      id: String(payload.user.id).trim(),
      name: String(payload.user.name).trim(),
      email: payload.user.email == null ? null : String(payload.user.email).trim(),
    },
    roles: payload.roles.map((role) => ({ code: String(role.code), name: String(role.name) })),
    grants: payload.grants.map((grant) => ({ permission: String(grant.permission), scope: grant.scope })),
  };
}

async function loadApiSession({ signal } = {}) {
  const response = await fetch(`${API_BASE_URL}${SESSION_PATH}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (response.status === 401) return publicSession();
  if (!response.ok) throw new Error(`Não foi possível carregar a sessão (${response.status}).`);
  return normalizeSession(await response.json());
}

export function createSessionClient() {
  return {
    load: loadApiSession,
  };
}
