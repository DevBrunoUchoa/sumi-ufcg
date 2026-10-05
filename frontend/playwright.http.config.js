import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

// Runs the production HTTP adapter against intercepted API responses, without
// development workspace/session middleware or a database dependency.
export default defineConfig({
  ...base,
  testMatch: /pdi-http\.spec\.js/,
  testIgnore: [],
  use: { ...base.use, baseURL: 'http://127.0.0.1:4322' },
  projects: [{ name: 'http' }],
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4322 --strictPort',
    env: { VITE_DATA_SOURCE: 'http' },
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
