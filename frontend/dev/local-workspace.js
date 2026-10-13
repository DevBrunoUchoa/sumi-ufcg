import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initialState } from '../src/data.js';
import { validateWorkspace } from '../src/domain.js';

const path = fileURLToPath(new URL('../../.local-preview/workspace.json', import.meta.url));

// Não importa JSON no bundle: o arquivo privado só é lido pelo middleware serve.
export function localDevelopmentWorkspace() {
  if (!existsSync(path)) return initialState();
  const workspace = JSON.parse(readFileSync(path, 'utf8'));
  if (!workspace.localPreview?.revision || !validateWorkspace(workspace)) throw new Error('Prévia local inválida. Execute pnpm --filter backend previa-local novamente.');
  return workspace;
}
