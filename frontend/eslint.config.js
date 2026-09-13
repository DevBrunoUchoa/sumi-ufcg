import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // O frontend veio do protótipo aprovado (sumi-prototipo), cujas telas
      // agrupam várias funções de componente por arquivo (main.jsx) e usam
      // efeitos para carregar sessão/workspace — padrões intencionais do
      // layout já validado, não bugs. Mantidos como aviso (não erro) em vez
      // de reescrever a estrutura aprovada só para satisfazer regras novas
      // de ergonomia (Fast Refresh / React Compiler) deste eslint.config.js,
      // que o protótipo nunca rodou.
      'react-refresh/only-export-components': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Configuração de build (Node, não navegador).
    files: ['vite.config.js', 'playwright.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Fixtures do Playwright: `page.use(...)` é a API do Playwright, não um
    // Hook React — as regras de react-hooks não se aplicam a testes e2e.
    files: ['tests/e2e/**/*.js'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
])
