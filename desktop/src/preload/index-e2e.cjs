"use strict";
// Playwright-compatible preload for E2E testing
const { app } = require('electron');
const { contextBridge, ipcRenderer } = require('electron');

function getVideoBaseUrl() {
  return app.isPackaged
    ? `file://${app.getPath('resourcesPath')}/videos`
    : 'http://localhost:5174/videos';
}

function getVideoUrl(filename) {
  return `${getVideoBaseUrl()}/role1/${filename}`;
}

// Playwright: must set __playwright_run for electron.launch() to work
globalThis.__playwright_run = async () => {
  if (!app.isReady()) {
    await new Promise((resolve) => { app.once('ready', resolve); });
  }
};

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDesktop: true,
  getVideoBaseUrl,
  getVideoUrl,
  showMainWindow: () => ipcRenderer.invoke('window:show-main'),
  hideMainWindow: () => ipcRenderer.invoke('window:hide-main'),
  minimizeToTray: () => ipcRenderer.invoke('window:minimize-to-tray'),
  pushBotState: (state) => ipcRenderer.invoke('bot-state:push', state),
  checkOpenClaw: () => ipcRenderer.invoke('openclaw:check'),
  installOpenClaw: () => ipcRenderer.invoke('openclaw:install'),
  runOpenClawDoctor: () => ipcRenderer.invoke('openclaw:doctor'),
  runOpenClawCommand: (cmd) => ipcRenderer.invoke('openclaw:run-command', cmd),
  listAgents: () => ipcRenderer.invoke('openclaw:agents-list'),
  listSkills: () => ipcRenderer.invoke('openclaw:skills-list'),
  installSkill: (name) => ipcRenderer.invoke('openclaw:skills-install', name),
  uninstallSkill: (name) => ipcRenderer.invoke('openclaw:skills-uninstall', name),
  listBackups: () => ipcRenderer.invoke('openclaw:backup-list'),
  restoreBackup: (id) => ipcRenderer.invoke('openclaw:backup-restore', id),
  createPairingCode: () => ipcRenderer.invoke('openclaw:pairing-create'),
  createQrCode: (label) => ipcRenderer.invoke('pairing:createQr', label),
  createPairingQr: (label) => ipcRenderer.invoke('pairing:createQr', label),
  pollPairingStatus: (code) => ipcRenderer.invoke('pairing:pollStatus', code),
  getGatewayStatus: () => ipcRenderer.invoke('gateway:status'),
  restartGateway: () => ipcRenderer.invoke('gateway:restart'),
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  onBotStateChange: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('bot-state:changed', handler);
    return () => ipcRenderer.removeListener('bot-state:changed', handler);
  },
  onInstallProgress: (callback) => {
    const handler = (_event, msg) => callback(msg);
    ipcRenderer.on('openclaw:install-progress', handler);
    return () => ipcRenderer.removeListener('openclaw:install-progress', handler);
  },
});
