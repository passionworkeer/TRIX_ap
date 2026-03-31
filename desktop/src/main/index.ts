import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { config as dotenvConfig } from 'dotenv';
import { setupIpcHandlers } from './ipc';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';

// ── Load .env.local ──────────────────────────────────────────────────────────
// In dev: app.getAppPath() = project root → desktop/.env.local
// In packaged: .env.local is extracted via asarUnpack
const envPaths = [
  path.join(app.getAppPath(), 'desktop', '.env.local'),   // dev mode
  path.join(app.getAppPath(), '..', '.env.local'),         // packaged: asarUnpack extracts to app.asar.unpacked
  path.join(path.dirname(app.getPath('exe')), '.env.local'), // packaged: next to exe
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenvConfig({ path: p });
    break;
  }
}

// Playwright E2E: required for electron.launch() CDP protocol
// Without this, Runtime.evaluate("__playwright_run()") hangs forever in the packaged app
// Use app.whenReady() which resolves immediately if already ready
globalThis.__playwright_run = async () => {
  await app.whenReady();
};

import { checkOpenClaw } from './openclaw';
import { startGateway, stopGateway } from './gateway';
import { createTray } from './tray';
import { createFloatWindow } from './float-window';
import { getPreloadPath, getMainUrl, setMainWindow, showMainWindow } from './window-state';
import { destroyTray } from './tray';
import { petStateManager } from './pet-state';

// FIRST: Write a marker file to prove the bundle is running
try {
  fs.writeFileSync(path.join(app.getPath('temp'), 'trix-startup.txt'),
    `TRIX Companion bundle loaded at ${new Date().toISOString()}\n`, 'utf8');
} catch (e) {}

// Configure logging
// NOTE: full electron-log initialization disabled — use console writes in packaged mode
try {
  log.transports.file.setAppName('TRIX Companion');
  log.initialize({ preload: false });
  log.transports.file.level = 'info';
  log.transports.console.level = 'debug';
  log.info('=== TRIX Companion Desktop Starting ===');
  log.info(`Electron: ${process.versions.electron}, Node: ${process.versions.node}, Chrome: ${process.versions.chrome}`);
  log.info('App path:', app.getAppPath());
  log.info('User data:', app.getPath('userData'));
  log.info('Preload:', getPreloadPath());
  log.info('Main URL:', getMainUrl());
} catch (err) {
  console.error('[ELECTRON-LOG ERROR]', err);
}

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
let isQuitting = false;

export function createMainWindow(): void {
  log.info('Creating main window...');

  // ── Window bounds persistence ───────────────────────────────────────────────
  const windowStateStore = new Store<Record<string, unknown>>({
    name: 'window-state',
    defaults: { width: 1200, height: 800 },
  });
  const savedX = windowStateStore.get('x') as number | undefined;
  const savedY = windowStateStore.get('y') as number | undefined;
  const savedWidth = windowStateStore.get('width') as number;
  const savedHeight = windowStateStore.get('height') as number;

  const mainWindow = new BrowserWindow({
    x: savedX,
    y: savedY,
    width: savedWidth,
    height: savedHeight,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  // Save window bounds on close
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds();
    windowStateStore.set('x', bounds.x);
    windowStateStore.set('y', bounds.y);
    windowStateStore.set('width', bounds.width);
    windowStateStore.set('height', bounds.height);
  });

  mainWindow.loadFile(getMainUrl()).catch((err) => {
    console.error('[LOAD FILE ERROR]', err);
    log.error('loadFile failed:', err);
  });
  log.info('Main window URL:', getMainUrl());

  mainWindow.webContents.on('did-finish-load', () => {
    log.info('Main window did-finish-load');
    // Inject drag region CSS (frameless window requires this)
    mainWindow.webContents.insertCSS(`
      .app-drag-region { -webkit-app-region: drag; }
      .app-drag-region button, .app-no-drag { -webkit-app-region: no-drag; }
    `).catch((err) => log.error('Failed to inject drag CSS:', err));
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log.error('Main window did-fail-load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('Main window render-process-gone:', details.reason, details.exitCode);
  });

  mainWindow.once('ready-to-show', () => {
    log.info('Main window ready to show');
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }
    event.preventDefault();
    mainWindow.hide();
    log.info('Main window hidden to tray');
  });

  mainWindow.on('closed', () => {
    setMainWindow(null);
  });

  setMainWindow(mainWindow);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// Re-export
export { showMainWindow };

// App lifecycle
app.whenReady().then(async () => {
  log.info('App ready');

  setupIpcHandlers();

  const openclawStatus = await checkOpenClaw();
  log.info('OpenClaw status:', openclawStatus);

  createMainWindow();
  createFloatWindow();
  createTray();
  petStateManager.init();

  if (openclawStatus.installed) {
    // Start gateway in background — don't block app startup
    startGateway()
      .then(() => log.info('Gateway started'))
      .catch((err) => log.error('Gateway failed to start:', err));
  } else {
    log.info('OpenClaw not installed, skipping gateway');
  }

  log.info('=== TRIX Companion Desktop Started ===');
});

app.on('window-all-closed', () => {
  log.info('All windows closed, app continues in tray');
});

app.on('activate', () => {
  showMainWindow();
});

app.on('before-quit', async () => {
  isQuitting = true;
  log.info('App quitting...');
  await stopGateway();
  destroyTray();
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled rejection:', reason);
});
