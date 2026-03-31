import { BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { getPreloadPath, getFloatUrl, setFloatWindow } from './window-state';

export function createFloatWindow(): BrowserWindow {
  log.info('Creating float window...');

  const floatWindow = new BrowserWindow({
    width: 260,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  const floatUrl = getFloatUrl();
  if (floatUrl.startsWith('http')) {
    floatWindow.loadURL(floatUrl).catch((err) => log.error('Float loadURL failed:', err));
  } else {
    floatWindow.loadFile(floatUrl).catch((err) => log.error('Float loadFile failed:', err));
  }

  floatWindow.once('ready-to-show', () => {
    log.info('Float window ready to show');
    floatWindow.show();
  });

  floatWindow.on('closed', () => {
    setFloatWindow(null);
    log.info('Float window closed');
  });

  setFloatWindow(floatWindow);
  log.info('Float window created');
  return floatWindow;
}
