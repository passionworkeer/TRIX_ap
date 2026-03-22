/**
 * Unit tests for desktop/main/window-state.ts — window management module
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Hoistable electron mock — must be at top level for vitest's mock system
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => ({
    show: vi.fn(), hide: vi.fn(), isMinimized: vi.fn(() => false),
    isDestroyed: vi.fn(() => false), isVisible: vi.fn(() => true),
    restore: vi.fn(), focus: vi.fn(),
    webContents: { send: vi.fn() },
    loadFile: vi.fn().mockResolvedValue(undefined),
    loadURL: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(), once: vi.fn(), close: vi.fn(),
  })),
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => '/mock/app/path'),
    getPath: vi.fn((name: string) => ({ userData: '/mock/userData' })[name] ?? '/mock'),
    quit: vi.fn(), on: vi.fn(), once: vi.fn(),
  },
  ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
  Tray: vi.fn(),
  Menu: { buildFromTemplate: vi.fn(() => ({})) },
  nativeImage: { createFromBuffer: vi.fn(() => ({ isEmpty: () => false })) },
  shell: { openExternal: vi.fn() },
}));

import * as windowState from './window-state';

describe('window-state module', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports getPreloadPath as a function', () => {
    expect(typeof windowState.getPreloadPath).toBe('function');
  });

  it('getPreloadPath returns a string ending in preload/index.cjs', () => {
    const result = windowState.getPreloadPath();
    expect(typeof result).toBe('string');
    expect(result).toMatch(/preload[/\\]index\.cjs$/);
  });

  it('exports getMainUrl as a function', () => {
    expect(typeof windowState.getMainUrl).toBe('function');
  });

  it('getMainUrl returns a string ending in main.html', () => {
    const result = windowState.getMainUrl();
    expect(typeof result).toBe('string');
    expect(result).toMatch(/main\.html$/);
  });

  it('exports getFloatUrl as a function', () => {
    expect(typeof windowState.getFloatUrl).toBe('function');
  });

  it('getFloatUrl returns a string ending in float.html', () => {
    const result = windowState.getFloatUrl();
    expect(typeof result).toBe('string');
    expect(result).toMatch(/float\.html$/);
  });

  it('setMainWindow and getMainWindow work as a pair', () => {
    expect(windowState.getMainWindow()).toBeNull();
  });

  it('setFloatWindow and getFloatWindow work as a pair', () => {
    expect(windowState.getFloatWindow()).toBeNull();
  });

  it('showMainWindow is exported and callable with null window', () => {
    expect(typeof windowState.showMainWindow).toBe('function');
    expect(() => windowState.showMainWindow()).not.toThrow();
  });

  it('hideMainWindow is exported and callable with null window', () => {
    expect(typeof windowState.hideMainWindow).toBe('function');
    expect(() => windowState.hideMainWindow()).not.toThrow();
  });

  it('minimizeToTray is exported and callable with null window', () => {
    expect(typeof windowState.minimizeToTray).toBe('function');
    expect(() => windowState.minimizeToTray()).not.toThrow();
  });

  it('pushBotState is exported and callable with null window', () => {
    expect(typeof windowState.pushBotState).toBe('function');
    expect(() => windowState.pushBotState('IDLE')).not.toThrow();
    expect(() => windowState.pushBotState('THINKING')).not.toThrow();
    expect(() => windowState.pushBotState('SPEAKING')).not.toThrow();
  });
});
