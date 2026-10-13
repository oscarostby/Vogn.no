import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = process.env.E2E_BROWSER_EXECUTABLE || (process.platform === 'win32' && existsSync(edge) ? edge : undefined);
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 60_000, expect: { timeout: 15_000 }, reporter: 'list',
  use: { baseURL: 'http://localhost:3100', locale: 'en-US', headless: true, launchOptions: { executablePath }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node ../../scripts/e2e-server.mjs', url: 'http://localhost:3100/api/v1/health', reuseExistingServer: false, timeout: 180_000 },
});
