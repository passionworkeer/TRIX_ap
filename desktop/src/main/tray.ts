import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import path from 'path';
import log from 'electron-log/main';
import { getGatewayStatus } from './gateway';
import { runOpenClawCommand } from './openclaw';

let tray: Tray | null = null;

function showMainWindow(): void {
  const wins = BrowserWindow.getAllWindows();
  const main = wins.find(w => !w.isDestroyed());
  if (main) {
    if (main.isMinimized()) main.restore();
    main.show();
    main.focus();
  }
}

function hideMainWindow(): void {
  const wins = BrowserWindow.getAllWindows();
  const main = wins.find(w => !w.isDestroyed());
  main?.hide();
}

function getTrayIconPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, '../../../build/icon.ico');
  }
  return path.join(process.resourcesPath!, 'icon.ico');
}

export function createTray(): Tray {
  log.info('Creating system tray...');

  // Create a simple colored icon programmatically
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  // Fill with a gradient-ish purple color (BG8BFFFF = #8B8BFF from brand)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Simple circle
      const cx = size / 2, cy = size / 2, r = size / 2 - 1;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        canvas[idx] = 0x8b;     // R
        canvas[idx + 1] = 0x8b; // G
        canvas[idx + 2] = 0xff; // B
        canvas[idx + 3] = 255;  // A
      } else {
        canvas[idx + 3] = 0;    // Transparent
      }
    }
  }

  const icon = nativeImage.createFromBuffer(canvas, {
    width: size,
    height: size,
  });

  tray = new Tray(icon);
  tray.setToolTip('TRIX Companion');

  updateTrayMenu();

  tray.on('click', () => {
    const mainWin = BrowserWindow.getAllWindows().find(w => !w.isDestroyed());
    if (mainWin?.isVisible()) {
      hideMainWindow();
    } else {
      showMainWindow();
    }
  });

  tray.on('double-click', () => {
    showMainWindow();
  });

  log.info('System tray created');
  return tray;
}

export async function updateTrayMenu(): Promise<void> {
  if (!tray) return;

  const gatewayStatus = await getGatewayStatus();
  const gatewayLabel = gatewayStatus.running
    ? `Gateway: 运行中 (端口 ${gatewayStatus.port})`
    : 'Gateway: 已停止';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: showMainWindow,
    },
    {
      label: '隐藏主窗口',
      click: hideMainWindow,
    },
    { type: 'separator' },
    {
      label: gatewayLabel,
      enabled: false,
    },
    {
      label: '重启 Gateway',
      click: async () => {
        const { restartGateway } = await import('./gateway');
        await restartGateway();
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: '生成配对码',
      click: async () => {
        try {
          const result = await runOpenClawCommand('pairing create');
          if (result.success) {
            log.info('Pairing code created:', result.stdout);
          }
        } catch (err) {
          log.error('Pairing error:', err);
        }
      },
    },
    {
      label: 'OpenClaw 状态',
      click: async () => {
        try {
          const result = await runOpenClawCommand('status');
          if (result.success) {
            log.info('OpenClaw status:', result.stdout);
          }
        } catch (err) {
          log.error('Status error:', err);
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
