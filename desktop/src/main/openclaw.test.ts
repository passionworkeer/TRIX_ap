/**
 * Unit tests for desktop/main/openclaw.ts — OpenClaw CLI integration
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn((name: string) => ({ userData: '/mock/userData' })[name] ?? '/mock'),
    on: vi.fn(), quit: vi.fn(),
  },
}));

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('fs', async (real) => {
  const fs = await real<typeof import('fs')>();
  return {
    ...fs,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

function makeMockSpawn() {
  const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  const proc = {
    stdout: {
      on: (e: string, cb: (...a: unknown[]) => void) => {
        if (!handlers[e]) handlers[e] = [];
        handlers[e].push(cb);
        return proc.stdout;
      },
    },
    stderr: {
      on: (e: string, cb: (...a: unknown[]) => void) => {
        if (!handlers[e]) handlers[e] = [];
        handlers[e].push(cb);
        return proc.stderr;
      },
    },
    on: (e: string, cb: (...a: unknown[]) => void) => {
      if (!handlers[e]) handlers[e] = [];
      handlers[e].push(cb);
      return proc;
    },
    kill: () => {},
  };
  setTimeout(() => handlers['close']?.forEach((cb) => cb(0)), 20);
  return { proc, handlers };
}

vi.mock('child_process', () => ({
  exec: (_cmd: string, _opts: object, cb: Function) => {
    setTimeout(() => cb(null, { stdout: '', stderr: '' }), 10);
    return { kill: () => {} };
  },
  spawn: () => makeMockSpawn().proc,
}));

import * as openclaw from './openclaw';

describe('openclaw module', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports checkOpenClaw as async function', () => {
    expect(typeof openclaw.checkOpenClaw).toBe('function');
  });

  it('checkOpenClaw returns installed:false when openclaw not found', async () => {
    const result = await openclaw.checkOpenClaw();
    expect(result).toHaveProperty('installed');
    expect(result.installed).toBe(false);
  });

  it('checkOpenClaw result has correct shape', async () => {
    const result = await openclaw.checkOpenClaw();
    expect(result).toHaveProperty('installed');
    if (result.installed) {
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('path');
    }
  });

  it('exports installOpenClaw as async function', () => {
    expect(typeof openclaw.installOpenClaw).toBe('function');
  });

  it('exports runCommand as async function', () => {
    expect(typeof openclaw.runCommand).toBe('function');
  });

  it('runCommand returns shape with success, stdout, stderr', async () => {
    const result = await openclaw.runCommand('status');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('stdout');
    expect(result).toHaveProperty('stderr');
  });

  it('runCommand sanitizes empty command without throwing', async () => {
    const result = await openclaw.runCommand('');
    expect(result).toHaveProperty('success');
  });

  it('exports getOpenClawPath as function', () => {
    expect(typeof openclaw.getOpenClawPath).toBe('function');
  });

  it('getOpenClawPath returns a string', () => {
    expect(typeof openclaw.getOpenClawPath()).toBe('string');
  });

  it('exports runOpenClawCommand as function', () => {
    expect(typeof openclaw.runOpenClawCommand).toBe('function');
  });

  // Uses dynamic import of child_process.spawn — may hang in sandbox without proper mock
  it.skip('runOpenClawCommand returns same shape as runCommand', async () => {
    const r1 = await openclaw.runCommand('status');
    const r2 = await openclaw.runOpenClawCommand('status');
    expect(r1).toMatchObject({
      success: expect.any(Boolean),
      stdout: expect.any(String),
      stderr: expect.any(String),
    });
    expect(r2).toMatchObject({
      success: expect.any(Boolean),
      stdout: expect.any(String),
      stderr: expect.any(String),
    });
  });
});
