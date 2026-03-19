import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { setupIpcHandlers } from './ipc';
import { checkOpenClaw } from './openclaw';
import { startGateway, stopGateway } from './gateway';
import { createTray } from './tray';
import { createFloatWindow } from './float-window';
import { getPreloadPath, getMainUrl, getFloatUrl, setMainWindow, showMainWindow } from './window-state';
import { destroyTray } from './tray';

// Configure logging — initialize first so file transport is ready
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

log.info('=== TRIX Companion Desktop Starting ===');
log.info(`Electron: ${process.versions.electron}, Node: ${process.versions.node}, Chrome: ${process.versions.chrome}`);

const isDev = !app.isPackaged;

export function createMainWindow(): void {
  log.info('Creating main window...');

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

  mainWindow.loadFile(getMainUrl());
  log.info('Main window URL:', getMainUrl());

  mainWindow.webContents.on('did-finish-load', () => {
    log.info('Main window did-finish-load');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    log.error('Main window did-fail-load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log.error('Main window render-process-gone:', details.reason, details.exitCode);
  });

  mainWindow.webContents.on('crashed', () => {
    log.error('Main window crashed');
  });

  mainWindow.once('ready-to-show', () => {
    log.info('Main window ready to show');
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
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
