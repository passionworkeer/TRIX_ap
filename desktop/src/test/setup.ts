// Desktop test setup — mocks for Electron and native Node modules
import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// ── Electron mock ───────────────────────────────────────────────────────────
const mockBrowserWindow = {
  show: vi.fn(),
  hide: vi.fn(),
  isMinimized: vi.fn(() => false),
  isDestroyed: vi.fn(() => false),
  isVisible: vi.fn(() => true),
  restore: vi.fn(),
  focus: vi.fn(),
  webContents: { send: vi.fn() },
  loadFile: vi.fn().mockResolvedValue(undefined),
  loadURL: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  once: vi.fn(),
  close: vi.fn(),
};

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => mockBrowserWindow),
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => '/mock/app/path'),
    getPath: vi.fn((name: string) => {
      const map: Record<string, string> = {
        userData: '/mock/userData',
        resourcesPath: '/mock/resources',
        exe: '/mock/exe',
        home: '/mock/home',
      };
      return map[name] ?? '/mock';
    }),
    quit: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    removeListener: vi.fn(),
  },
  Tray: vi.fn(),
  Menu: {
    buildFromTemplate: vi.fn(() => ({})),
  },
  nativeImage: {
    createFromBuffer: vi.fn(() => ({ isEmpty: () => false })),
    createEmpty: vi.fn(() => ({ isEmpty: () => true })),
  },
  shell: { openExternal: vi.fn() },
}));

// ── electron-log mock ────────────────────────────────────────────────────────
vi.mock('electron-log/main', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── child_process mock ──────────────────────────────────────────────────────
const mockSpawn = {
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
  on: vi.fn((event: string, cb: (code: number) => void) => {
    if (event === 'close') setTimeout(() => cb(0), 10);
    if (event === 'error') setTimeout(() => cb(1), 10);
    return mockSpawn;
  }),
  kill: vi.fn(),
};

vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: object, cb: Function) => {
    setTimeout(() => cb(null, { stdout: '', stderr: '' }), 10);
    return { kill: vi.fn() } as unknown;
  }),
  spawn: vi.fn(() => mockSpawn),
}));

// ── fs mock ─────────────────────────────────────────────────────────────────
vi.mock('fs', async (real) => {
  const fs = await real<typeof import('fs')>();
  return {
    ...fs,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({ isFile: () => true, isDirectory: () => false })),
  };
});

// ── http / https mocks ──────────────────────────────────────────────────────
vi.mock('http', async (real) => {
  const http = await real<typeof import('http')>();
  return {
    ...http,
    request: vi.fn(() => ({
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'data') setTimeout(() => cb(Buffer.from('{}')), 5);
        if (event === 'end') setTimeout(() => cb(), 10);
        return this;
      }),
      setTimeout: vi.fn().mockReturnThis(),
      write: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'error') setTimeout(() => cb(new Error('mock')), 5);
        return this;
      }),
    })),
    get: vi.fn(),
  };
});

vi.mock('https', async (real) => {
  const https = await real<typeof import('https')>();
  return {
    ...https,
    request: vi.fn(),
    get: vi.fn(),
  };
});

// Re-export for use in tests
export { mockBrowserWindow };
