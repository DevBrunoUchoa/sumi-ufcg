import { validateWorkspace } from './domain.js';

const env = import.meta.env || {};
const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const WORKSPACE_PATH = env.VITE_PLANNING_WORKSPACE_PATH || '/api/v1/planning/workspace';
function createHttpClient() {
  let saveQueue = Promise.resolve();
  const request = async (path, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!response.ok) throw new Error(`Falha ao acessar os dados de planejamento (${response.status}).`);
    return response.status === 204 ? null : response.json();
  };
  return {
    async load({ signal } = {}) {
      const workspace = await request(WORKSPACE_PATH, { signal });
      if (!validateWorkspace(workspace)) throw new Error('O servidor retornou uma estrutura de planejamento inválida.');
      return workspace;
    },
    async save(workspace, { signal } = {}) {
      saveQueue = saveQueue.catch(() => undefined).then(() => request(WORKSPACE_PATH, { method: 'PUT', body: JSON.stringify(workspace), signal }));
      return saveQueue;
    },
    async removePlan(planId) {
      await request(`/api/v1/planning/planos/${encodeURIComponent(planId)}`, { method: 'DELETE' });
    },
  };
}

export function createPlanningClient() {
  // Vite removes this development-only import from production builds.
  if (import.meta.env.DEV && import.meta.env.VITE_DATA_SOURCE !== 'http') {
    const client = import('../dev/planning-client.js').then((module) => module.createDevelopmentClient());
    return {
      load: (options) => client.then((adapter) => adapter.load(options)),
      save: (workspace, options) => client.then((adapter) => adapter.save(workspace, options)),
      removePlan: (planId) => client.then((adapter) => adapter.removePlan(planId)),
    };
  }
  return createHttpClient();
}
