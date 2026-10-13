import { validateWorkspace, WORKSPACE_VERSION } from '../src/domain.js';
import { initialState } from '../src/data.js';
import { mergeLocalPreview } from '../src/planning/local-preview.js';

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

export function createDevelopmentClient() {
  return {
    async load({ signal } = {}) {
      const fallback = await loadDevelopmentData(signal);
      try {
        const raw = localStorage.getItem(MOCK_STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (!validateWorkspace(parsed)) return fallback;
        const axesMigrated = localStorage.getItem(LOCAL_PDI_AXES_MIGRATION_KEY) ? parsed : migrateLocalPdiAxes(parsed, fallback);
        const migrated = mergeLocalPreview(axesMigrated, fallback, initialState());
        const backupKey = `${MOCK_STORAGE_KEY}.backup.before-local-preview`;
        if (migrated !== axesMigrated && !localStorage.getItem(backupKey)) localStorage.setItem(backupKey, raw);
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

