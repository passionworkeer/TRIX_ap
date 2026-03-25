/**
 * Detox E2E Test Configuration
 *
 * Centralizes timeouts, retry strategies, and screenshot behavior
 * used across all test suites.
 */

import { Config } from 'detox';

const config: Config = {
  timeout: {
    // Element wait timeouts (ms)
    elementWait: 10000,
    elementExists: 5000,

    // Navigation/screen wait timeouts (ms)
    screenWait: 15000,
    deepLinkWait: 20000,

    // AI/chat response timeouts (ms) - AI responses can take longer
    aiResponseWait: 90000,

    // Auth timeouts (ms)
    loginWait: 15000,
    logoutWait: 8000,
  },

  retry: {
    // Number of retries for flaky UI interactions
    interactionAttempts: 3,

    // Delay between retry attempts (ms)
    retryDelayMs: 500,
  },

  screenshot: {
    // Screenshot output directory relative to detox root
    outputDir: './artifacts/screenshots',

    // Take screenshot on test failure (Detox default)
    takeOnFailure: true,

    // Take screenshot on every test start (can be noisy)
    takeOnTestStart: false,
  },

  // Test environment credentials - load from environment
  // Set TRIX_TEST_EMAIL and TRIX_TEST_PASSWORD in .env or CI secrets
  testCredentials: {
    get email(): string {
      return process.env.TRIX_TEST_EMAIL ?? '';
    },
    get password(): string {
      return process.env.TRIX_TEST_PASSWORD ?? '';
    },
    get valid(): boolean {
      return !!(this.email && this.password);
    },
  },
};

export default config;
