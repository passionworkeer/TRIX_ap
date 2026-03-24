/**
 * Unit tests for desktop/main/tray.ts — System tray lifecycle
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockGetGatewayStatus, mockRunOpenClawCommand, mockRestartGateway } = vi.hoisted(() => ({
  mockGetGatewayStatus: vi.fn(async () => ({ running: true, port: 18789 })),
  mockRunOpenClawCommand: vi.fn(async () => ({ success: true, stdout: 'ok' })),
  mockRestartGateway: vi.fn(async () => {}),
}));

vi.mock('electron', () => {
  const mockWindow = {
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    isVisible: vi.fn(() => true),
  };
  const TrayMock = vi.fn(() => ({
    setToolTip: vi.fn(),
    on: vi.fn(),
    setContextMenu: vi.fn(),
    destroy: vi.fn(),
  }));
  return {
    app: {
      getPath: vi.fn(() => '/mock/userData'),
      on: vi.fn(),
      quit: vi.fn(),
    },
    Tray: TrayMock,
    Menu: {
      buildFromTemplate: vi.fn((items: unknown[]) => items),
    },
    nativeImage: {
      createFromBuffer: vi.fn(() => ({})),
    },
    BrowserWindow: {
      getAllWindows: vi.fn(() => [mockWindow]),
    },
  };
});

vi.mock('electron-log/main', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./gateway', () => ({
  getGatewayStatus: mockGetGatewayStatus,
  restartGateway: mockRestartGateway,
}));

vi.mock('./openclaw', () => ({
  runOpenClawCommand: mockRunOpenClawCommand,
}));

import { createTray, updateTrayMenu, destroyTray } from './tray';

describe('tray', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports createTray as a function', () => {
    expect(typeof createTray).toBe('function');
  });

  it('exports updateTrayMenu as a function', () => {
    expect(typeof updateTrayMenu).toBe('function');
  });

  it('exports destroyTray as a function', () => {
    expect(typeof destroyTray).toBe('function');
  });

  it('createTray returns a Tray instance', () => {
    const tray = createTray();
    expect(tray).toBeDefined();
    expect(typeof tray).toBe('object');
  });

  it('createTray sets tooltip to TRIX Companion', () => {
    const tray = createTray();
    expect(tray.setToolTip).toHaveBeenCalledWith('TRIX Companion');
  });

  it('createTray registers click and double-click handlers', () => {
    const tray = createTray();
    expect(tray.on).toHaveBeenCalledWith('click', expect.any(Function));
    expect(tray.on).toHaveBeenCalledWith('double-click', expect.any(Function));
  });

  it('updateTrayMenu calls getGatewayStatus', async () => {
    createTray();
    await updateTrayMenu();
    expect(mockGetGatewayStatus).toHaveBeenCalled();
  });

  it('updateTrayMenu builds menu with gateway status', async () => {
    createTray();
    await updateTrayMenu();
    const { Menu } = await import('electron');
    expect(Menu.buildFromTemplate).toHaveBeenCalled();
    const items = (Menu.buildFromTemplate as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const labels = items.map((i: { label?: string }) => i.label);
    expect(labels).toContain('显示主窗口');
    expect(labels).toContain('隐藏主窗口');
    expect(labels).toContain('Gateway: 运行中 (端口 18789)');
    expect(labels).toContain('重启 Gateway');
    expect(labels).toContain('退出');
  });

  it('destroyTray does not throw when tray is null', () => {
    // Tray not created yet
    expect(() => destroyTray()).not.toThrow();
  });

  it('destroyTray calls destroy on existing tray', () => {
    const tray = createTray();
    destroyTray();
    expect(tray.destroy).toHaveBeenCalled();
  });
});
