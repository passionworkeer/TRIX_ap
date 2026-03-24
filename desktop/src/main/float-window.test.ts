/**
 * Unit tests for desktop/main/float-window.ts — Float window creation
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockSetFloatWindow, mockGetPreloadPath, mockGetFloatUrl } = vi.hoisted(() => ({
  mockSetFloatWindow: vi.fn(),
  mockGetPreloadPath: vi.fn(() => '/mock/preload.cjs'),
  mockGetFloatUrl: vi.fn(() => '/mock/float.html'),
}));

vi.mock('electron', () => {
  const mockWindow = {
    loadFile: vi.fn(),
    once: vi.fn((_event: string, cb: () => void) => cb()),
    on: vi.fn((_event: string, cb: () => void) => cb()),
    show: vi.fn(),
    isDestroyed: vi.fn(() => false),
    webContents: { send: vi.fn() },
  };
  const BrowserWindow = vi.fn(() => mockWindow);
  return {
    app: { getPath: vi.fn(() => '/mock/userData'), on: vi.fn() },
    BrowserWindow,
  };
});

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./window-state', () => ({
  getPreloadPath: mockGetPreloadPath,
  getFloatUrl: mockGetFloatUrl,
  setFloatWindow: mockSetFloatWindow,
}));

import { createFloatWindow } from './float-window';

describe('float-window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports createFloatWindow as a function', () => {
    expect(typeof createFloatWindow).toBe('function');
  });

  it('creates a BrowserWindow with correct float config', async () => {
    createFloatWindow();
    const { BrowserWindow } = await import('electron');
    expect(BrowserWindow).toHaveBeenCalled();
    const config = (BrowserWindow as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.width).toBe(220);
    expect(config.height).toBe(320);
    expect(config.frame).toBe(false);
    expect(config.transparent).toBe(true);
    expect(config.alwaysOnTop).toBe(true);
    expect(config.resizable).toBe(false);
    expect(config.skipTaskbar).toBe(true);
    expect(config.show).toBe(false);
  });

  it('uses correct preload path from window-state', () => {
    createFloatWindow();
    expect(mockGetPreloadPath).toHaveBeenCalled();
  });

  it('loads float HTML from correct path', () => {
    createFloatWindow();
    expect(mockGetFloatUrl).toHaveBeenCalled();
  });

  it('calls setFloatWindow with the created window', () => {
    vi.clearAllMocks();
    createFloatWindow();
    // setFloatWindow is called with the window, then with null on close handler
    expect(mockSetFloatWindow).toHaveBeenCalled();
    expect(mockSetFloatWindow).toHaveBeenCalledWith(expect.any(Object));
  });

  it('returns a window object', () => {
    const win = createFloatWindow();
    expect(win).toBeDefined();
    expect(typeof win).toBe('object');
  });
});
