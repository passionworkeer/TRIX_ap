import { BrowserWindow, app } from 'electron';
import path from 'path';

let _mainWindow: BrowserWindow | null = null;
let _floatWindow: BrowserWindow | null = null;

function getPreloadPath(): string {
  return path.join(app.getAppPath(), 'dist-desktop', 'preload', 'index.cjs');
}

function getMainUrl(): string {
  return path.join(app.getAppPath(), 'dist-desktop', 'renderer', 'desktop', 'src', 'renderer', 'main.html');
}

function getFloatUrl(): string {
  return path.join(app.getAppPath(), 'dist-desktop', 'renderer', 'desktop', 'src', 'renderer', 'float.html');
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
