/**
 * Simplified tests for environment variable utilities
 *
 * Tests the exported functions exist and have correct types.
 */
import { describe, it, expect } from 'vitest';

describe('env utilities', () => {
  describe('module exports', () => {
    it('should export isDev function', async () => {
      const env = await import('../../src/utils/env');
      expect(typeof env.isDev).toBe('function');
    });

    it('should export isEnvVarSet function', async () => {
      const env = await import('../../src/utils/env');
      expect(typeof env.isEnvVarSet).toBe('function');
    });

    it('should export getRequiredEnv function', async () => {
      const env = await import('../../src/utils/env');
      expect(typeof env.getRequiredEnv).toBe('function');
    });

    it('should export validateEnv function', async () => {
      const env = await import('../../src/utils/env');
      expect(typeof env.validateEnv).toBe('function');
    });
  });
});
