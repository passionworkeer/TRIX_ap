import { defineConfig } from '@playwright/test';

const ELECTRON_PATH = 'C:/Users/wang/Desktop/TRIX Companion 3/win-unpacked/TRIX Companion.exe';
const CDP_PORT = 9228;

export default defineConfig({
  testDir: '.',
  testMatch: 'desktop.spec.ts',
  timeout: 60_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
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

export { ELECTRON_PATH, CDP_PORT };
