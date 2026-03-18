import { BrowserWindow, app } from 'electron';

let _mainWindow: BrowserWindow | null = null;
let _floatWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;

function getPreloadPath(): string {
  // app.getAppPath() = project root in dev, app root in prod
  // dist-desktop is at: desktop/dist-desktop/ (dev) or appRoot/dist-desktop/ (prod)
  return `${app.getAppPath()}/dist-desktop/preload/index.js`;
}

function getMainUrl(): string {
  // Built HTML is at: desktop/dist-desktop/renderer/desktop/src/renderer/main.html
  return `file://${app.getAppPath()}/dist-desktop/renderer/desktop/src/renderer/main.html`;
}

function getFloatUrl(): string {
  return `file://${app.getAppPath()}/dist-desktop/renderer/desktop/src/renderer/float.html`;
}

export { getPreloadPath, getMainUrl, getFloatUrl };

export function setMainWindow(win: BrowserWindow | null): void {
  _mainWindow = win;
}

export function setFloatWindow(win: BrowserWindow | null): void {
  _floatWindow = win;
}

export function showMainWindow(): void {
  if (_mainWindow) {
    if (_mainWindow.isMinimized()) _mainWindow.restore();
    _mainWindow.show();
    _mainWindow.focus();
  }
}

export function hideMainWindow(): void {
  _mainWindow?.hide();
}

export function minimizeToTray(): void {
  _mainWindow?.hide();
}

export function pushBotState(state: unknown): void {
  if (_floatWindow && !_floatWindow.isDestroyed()) {
    _floatWindow.webContents.send('bot-state:changed', state);
  }
}

export function getMainWindow(): BrowserWindow | null {
  return _mainWindow;
}

export function getFloatWindow(): BrowserWindow | null {
  return _floatWindow;
}
