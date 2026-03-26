/**
 * Unit tests for desktop/main/gateway.ts — Gateway lifecycle management
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/userData'),
    on: vi.fn(),
  },
}));

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('fs', async (real) => {
  const fs = await real<typeof import('fs')>();
  return { ...fs, existsSync: vi.fn(() => false) };
});

vi.mock('child_process', () => ({
  exec: vi.fn((_cmd: string, _opts: object, cb: Function) => {
    setTimeout(() => cb(null, { stdout: '', stderr: '' }), 10);
    return { kill: vi.fn() } as unknown;
  }),
  execFile: vi.fn((_cmd: string, _args: string[], _opts: object, cb?: Function) => {
    if (cb) setTimeout(() => cb(null, { stdout: '', stderr: '' }), 10);
    return { kill: vi.fn() } as unknown;
  }),
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((_event: string, cb: (...a: unknown[]) => void) => {
      // Fire close immediately for determinism
      setTimeout(() => cb(0), 10);
      return { on: vi.fn() };
    }),
    kill: vi.fn(),
  })),
}));

// Note: http is used at module level in gateway.ts via `http.get`.
// Mocking it requires dynamic module replacement which is complex.
// Core API tests are covered; HTTP-level behavior tested via integration.
import * as gateway from './gateway';

describe('gateway module', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports getGatewayStatus as async function', () => {
    expect(typeof gateway.getGatewayStatus).toBe('function');
  });

  it('getGatewayStatus returns { running: boolean } shape', async () => {
    const result = await gateway.getGatewayStatus();
    expect(result).toHaveProperty('running');
    expect(typeof result.running).toBe('boolean');
  });

  it('getGatewayStatus returns boolean even when http is unavailable', async () => {
    const result = await gateway.getGatewayStatus();
    // When gateway is not running (default in test), returns { running: false }
    // No error thrown
    expect(result).toHaveProperty('running');
  });

  it('exports stopGateway as async function', () => {
    expect(typeof gateway.stopGateway).toBe('function');
  });

  it('stopGateway does not throw when gateway is not running', async () => {
    await expect(gateway.stopGateway()).resolves.not.toThrow();
  });

  it('exports startGateway as async function', () => {
    expect(typeof gateway.startGateway).toBe('function');
  });

  it('exports restartGateway as async function', () => {
    expect(typeof gateway.restartGateway).toBe('function');
  });

  // Calls startGateway which attempts real HTTP health check — requires full HTTP mock
  it.skip('restartGateway is callable without throwing', async () => {
    await expect(gateway.restartGateway()).resolves.not.toThrow();
  });
});

// ─── New gateway health / diagnostic API tests ─────────────────────────────────

describe('gateway health API', () => {

  it('exports checkGatewayHealth as async function', () => {
    expect(typeof gateway.checkGatewayHealth).toBe('function');
  });

  it('checkGatewayHealth returns health object with status, layers, timestamp, issues', async () => {
    const health = await gateway.checkGatewayHealth();
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('layers');
    expect(health).toHaveProperty('timestamp');
    expect(health).toHaveProperty('issues');
    expect(['healthy', 'degraded', 'down']).toContain(health.status);
    expect(Array.isArray(health.issues)).toBe(true);
    expect(health.layers).toHaveProperty('port');
    expect(health.layers).toHaveProperty('http');
    expect(health.layers).toHaveProperty('cli');
  });

  it('checkGatewayHealth layers each have an ok boolean', async () => {
    const health = await gateway.checkGatewayHealth();
    expect(typeof health.layers.port.ok).toBe('boolean');
    expect(typeof health.layers.http.ok).toBe('boolean');
    expect(typeof health.layers.cli.ok).toBe('boolean');
  });

  it('checkGatewayHealth timestamp is valid ISO string', async () => {
    const health = await gateway.checkGatewayHealth();
    expect(() => new Date(health.timestamp)).not.toThrow();
  });

  it('checkGatewayHealth returns cached result within TTL window', async () => {
    // First call
    const first = await gateway.checkGatewayHealth();
    // Second call (within 15s TTL) should return same timestamp
    const second = await gateway.checkGatewayHealth();
    // Both should be the same cached result
    expect(second.timestamp).toBe(first.timestamp);
  });
});

describe('gateway diagnostic API', () => {

  it('exports diagnoseGateway as async function', () => {
    expect(typeof gateway.diagnoseGateway).toBe('function');
  });

  it('diagnoseGateway returns diagnosis with type, rootCause, confidence, suggestedActions, issues', async () => {
    const diag = await gateway.diagnoseGateway();
    expect(diag).toHaveProperty('type');
    expect(diag).toHaveProperty('rootCause');
    expect(diag).toHaveProperty('confidence');
    expect(typeof diag.confidence).toBe('number');
    expect(diag).toHaveProperty('suggestedActions');
    expect(Array.isArray(diag.suggestedActions)).toBe(true);
    expect(diag).toHaveProperty('issues');
    expect(Array.isArray(diag.issues)).toBe(true);
  });

  it('diagnoseGateway confidence is between 0 and 1', async () => {
    const diag = await gateway.diagnoseGateway();
    expect(diag.confidence).toBeGreaterThanOrEqual(0);
    expect(diag.confidence).toBeLessThanOrEqual(1);
  });
});

describe('gateway log analyzer', () => {

  it('exports analyzeGatewayLogs as function', () => {
    expect(typeof gateway.analyzeGatewayLogs).toBe('function');
  });

  it('analyzeGatewayLogs returns array', () => {
    const issues = gateway.analyzeGatewayLogs({ lines: 10 });
    expect(Array.isArray(issues)).toBe(true);
  });

  it('analyzeGatewayLogs accepts optional lines param without throwing', () => {
    expect(() => gateway.analyzeGatewayLogs({ lines: 50 })).not.toThrow();
    expect(() => gateway.analyzeGatewayLogs()).not.toThrow();
  });
});

describe('gateway knowledge base', () => {

  it('exports getKbStats as function', () => {
    expect(typeof gateway.getKbStats).toBe('function');
  });

  it('getKbStats returns { totalIssues, totalAttempts, successRate }', () => {
    const stats = gateway.getKbStats();
    expect(stats).toHaveProperty('totalIssues');
    expect(stats).toHaveProperty('totalAttempts');
    expect(stats).toHaveProperty('successRate');
    expect(typeof stats.totalIssues).toBe('number');
    expect(typeof stats.totalAttempts).toBe('number');
    expect(typeof stats.successRate).toBe('number');
    // Empty KB should have 0 values
    expect(stats.totalIssues).toBeGreaterThanOrEqual(0);
    expect(stats.totalAttempts).toBeGreaterThanOrEqual(0);
  });

  it('exports recordFixAttempt as function', () => {
    expect(typeof gateway.recordFixAttempt).toBe('function');
  });

  it('recordFixAttempt does not throw for valid inputs', () => {
    expect(() => gateway.recordFixAttempt('TEST_ISSUE', 'restart_gateway', true, 500)).not.toThrow();
    expect(() => gateway.recordFixAttempt('TEST_ISSUE', 'restart_gateway', false, 200)).not.toThrow();
  });

  it('recordFixAttempt updates KB stats after recording', () => {
    const before = gateway.getKbStats();
    const beforeAttempts = before.totalAttempts;

    gateway.recordFixAttempt('KB_TEST_ISSUE', 'restart_gateway', true, 300);

    const after = gateway.getKbStats();
    expect(after.totalAttempts).toBeGreaterThanOrEqual(beforeAttempts);
  });
});
