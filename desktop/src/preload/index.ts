import { contextBridge, ipcRenderer } from 'electron';
import { app } from 'electron';
import type { BotState } from '../types/electron.d.ts';

// Resolve video base URL for Electron
function getVideoBaseUrl(): string {
  if (!app.isPackaged) {
    // Dev: use Vite dev server at localhost
    return 'http://localhost:5174/videos';
  }
  // Prod: extraResources go to process.resourcesPath
  // app.getPath('resourcesPath') is properly typed in Electron preload context
  return `file://${app.getPath('resourcesPath')}/videos`;
}

const videoBaseUrl = getVideoBaseUrl();

// Electron API exposed to renderer
const electronAPI = {
  // === OpenClaw ===
  checkOpenClaw: () =>
    ipcRenderer.invoke('openclaw:check'),

  installOpenClaw: () =>
    ipcRenderer.invoke('openclaw:install'),

  // NOTE: runOpenClawCommand is NOT exposed to renderer — security risk
  // Use specific typed commands below instead

  runOpenClawDoctor: () =>
    ipcRenderer.invoke('openclaw:doctor'),

  // Generic command runner (allowlist enforced in main process IPC)
  runOpenClawCommand: (cmd: string) =>
    ipcRenderer.invoke('openclaw:run-command', cmd),

  listAgents: () =>
    ipcRenderer.invoke('openclaw:agents-list'),

  listSkills: () =>
    ipcRenderer.invoke('openclaw:skills-list'),

  installSkill: (name: string) =>
    ipcRenderer.invoke('openclaw:skills-install', name),

  uninstallSkill: (name: string) =>
    ipcRenderer.invoke('openclaw:skills-uninstall', name),

  listBackups: () =>
    ipcRenderer.invoke('openclaw:backup-list'),

  restoreBackup: (backupId: string) =>
    ipcRenderer.invoke('openclaw:backup-restore', backupId),

  createPairingCode: () =>
    ipcRenderer.invoke('openclaw:pairing-create'),

  // === Native Channel Pairing ===
  createPairingQr: (label?: string) =>
    ipcRenderer.invoke('pairing:createQr', label),

  pollPairingStatus: (code: string) =>
    ipcRenderer.invoke('pairing:pollStatus', code),

  // === Gateway ===
  getGatewayStatus: () =>
    ipcRenderer.invoke('gateway:status'),

  restartGateway: () =>
    ipcRenderer.invoke('gateway:restart'),

  // === Window Management ===
  showMainWindow: () =>
    ipcRenderer.invoke('window:show-main'),

  hideMainWindow: () =>
    ipcRenderer.invoke('window:hide-main'),

  minimizeToTray: () =>
    ipcRenderer.invoke('window:minimize-to-tray'),

  // === BotState Push (main window → main process) ===
  pushBotState: (state: BotState) =>
    ipcRenderer.invoke('bot-state:push', state),

  // === App Info ===
  getAppInfo: () =>
    ipcRenderer.invoke('app:info'),

  // === Event Listeners (main process → renderer) ===
  onBotStateChange: (callback: (state: BotState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: BotState) => callback(state);
    ipcRenderer.on('bot-state:changed', handler);
    return () => ipcRenderer.removeListener('bot-state:changed', handler);
  },

  onInstallProgress: (callback: (msg: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, msg: string) => callback(msg);
    ipcRenderer.on('openclaw:install-progress', handler);
    return () => ipcRenderer.removeListener('openclaw:install-progress', handler);
  },

  onGatewayStatusChange: (callback: (status: { running: boolean; port?: number; url?: string; error?: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: { running: boolean; port?: number; url?: string; error?: string }) => callback(status);
    ipcRenderer.on('gateway:status-changed', handler);
    return () => ipcRenderer.removeListener('gateway:status-changed', handler);
  },

  // === Platform Info ===
  platform: 'windows' as const,
  isDesktop: true,

  // === Video URLs (Electron only) ===
  getVideoBaseUrl: (): string => videoBaseUrl,
  getVideoUrl: (filename: string): string => `${videoBaseUrl}/role1/${filename}`,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
