import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoElectronPath = path.resolve(configDir, 'node_modules/electron/dist/electron.exe');
const repoDesktopAppPath = path.resolve(configDir, 'desktop');
const repoPackagedPath = path.resolve(configDir, 'desktop/release2/win-unpacked/TRIX Companion.exe');
const externalPackagedPath = 'C:/Users/wang/Desktop/TRIX Companion 3/win-unpacked/TRIX Companion.exe';
const requestedTarget = process.env.PLAYWRIGHT_DESKTOP_TARGET === 'packaged' ? 'packaged' : 'repo';
const packagedElectronPath = existsSync(repoPackagedPath) ? repoPackagedPath : externalPackagedPath;
const useRepoTarget = requestedTarget === 'repo' && existsSync(repoElectronPath);
const DESKTOP_TARGET = useRepoTarget ? 'repo' : 'packaged';
const ELECTRON_PATH = process.env.PLAYWRIGHT_ELECTRON_PATH
  || (useRepoTarget ? repoElectronPath : packagedElectronPath);
const ELECTRON_ARGS = process.env.PLAYWRIGHT_ELECTRON_APP
  ? [process.env.PLAYWRIGHT_ELECTRON_APP]
  : (useRepoTarget ? [repoDesktopAppPath] : []);
const CDP_PORT = 9228;

export default defineConfig({
  testDir: '.',
  testMatch: 'desktop.spec.ts',
  testIgnore: ['tests/e2e/**'],
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './playwright-desktop.global-setup.ts',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Launch Electron app for each test file
  webServer: undefined,

  projects: [
    {
      name: 'electron',
      testMatch: /desktop\.spec\.ts/,
      use: {
        // We'll manage browser launch manually per test
      },
    },
  ],
});

export { ELECTRON_PATH, ELECTRON_ARGS, CDP_PORT, DESKTOP_TARGET };
