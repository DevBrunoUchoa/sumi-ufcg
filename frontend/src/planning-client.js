import { validateWorkspace, WORKSPACE_VERSION } from './domain.js';

const env = import.meta.env || {};
const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const WORKSPACE_PATH = env.VITE_PLANNING_WORKSPACE_PATH || '/api/v1/planning/workspace';
const MOCK_STORAGE_KEY = `sumi.frontend.workspace.v${WORKSPACE_VERSION}`;
const LOCAL_PDI_AXES_MIGRATION_KEY = 'sumi.frontend.pdi-axes-preview.v1';

function migrateLocalPdiAxes(workspace, fallback) {
  const currentPdi = workspace.plans.find((plan) => plan.id === 'pdi' && plan.type === 'PDI');
  const examplePdi = fallback.plans.find((plan) => plan.id === 'pdi' && plan.type === 'PDI');
  if (!currentPdi || !examplePdi) return workspace;
  const existingCodes = new Set(currentPdi.axes.map((axis) => String(axis.code).trim().replace(/^0+(?=\d)/, '')));
  currentPdi.axes = [
    ...examplePdi.axes.filter((axis) => !existingCodes.has(axis.code)),
    ...currentPdi.axes,
  ];
  const axis8 = currentPdi.axes.find((axis) => String(axis.code).trim() === '8');
  if (axis8?.color?.toLowerCase() === '#2f78a5') axis8.color = '#b5336f';
  return workspace;
}

async function loadDevelopmentData(signal) {
  const response = await fetch('/__dev/planning/workspace', { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Não foi possível carregar os dados de desenvolvimento.');
  return response.json();
}

function createDevelopmentClient() {
  return {
    async load({ signal } = {}) {
      const fallback = await loadDevelopmentData(signal);
      try {
        const raw = localStorage.getItem(MOCK_STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (!validateWorkspace(parsed)) return fallback;
        if (localStorage.getItem(LOCAL_PDI_AXES_MIGRATION_KEY)) return parsed;
        const migrated = migrateLocalPdiAxes(parsed, fallback);
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(migrated));
        localStorage.setItem(LOCAL_PDI_AXES_MIGRATION_KEY, 'done');
        return migrated;
      } catch {
        return fallback;
      }
    },
    async save(workspace) {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(workspace));
      return workspace;
    },
  };
}

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
  };
}

export function createPlanningClient() {
  const source = env.VITE_DATA_SOURCE || (env.DEV ? 'local' : 'http');
  return source === 'local' ? createDevelopmentClient() : createHttpClient();
}
