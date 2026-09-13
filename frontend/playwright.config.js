import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4317', channel: 'msedge', locale: 'pt-BR', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop' }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: 'msedge' }, testMatch: /mobile\.spec\.js/ }],
  webServer: { command: 'pnpm dev', url: 'http://127.0.0.1:4317', reuseExistingServer: true, timeout: 30000 },
});
