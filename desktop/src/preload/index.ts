import { contextBridge, ipcRenderer } from 'electron';
import { app } from 'electron';

// Types
export interface OpenClawStatus {
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export interface OpenClawCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface GatewayStatus {
  running: boolean;
  port?: number;
  url?: string;
  error?: string;
}

export interface AppInfo {
  version: string;
  name: string;
  electron: string;
  node: string;
  chrome: string;
  platform: string;
  userData: string;
  isPackaged: boolean;
}

export type BotState = 'IDLE' | 'THINKING' | 'SPEAKING';

// Resolve video base URL for Electron
function getVideoBaseUrl(): string {
  if (!app.isPackaged) {
    // Dev: use Vite dev server at localhost
    return 'http://localhost:5174/videos';
  }
  // Prod: extraResources go to process.resourcesPath
  return `file://${process.resourcesPath!}/videos`;
}

const videoBaseUrl = getVideoBaseUrl();

// Electron API exposed to renderer
const electronAPI = {
  // === OpenClaw ===
  checkOpenClaw: (): Promise<OpenClawStatus> =>
    ipcRenderer.invoke('openclaw:check'),

  installOpenClaw: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('openclaw:install'),

  // NOTE: runOpenClawCommand is NOT exposed to renderer — security risk
  // Use specific typed commands below instead

  runOpenClawDoctor: (): Promise<OpenClawCommandResult> =>
    ipcRenderer.invoke('openclaw:doctor'),

  // Generic command runner (allowlist enforced in main process IPC)
  runOpenClawCommand: (cmd: string): Promise<OpenClawCommandResult> =>
    ipcRenderer.invoke('openclaw:run-command', cmd),

  listAgents: (): Promise<OpenClawCommandResult> =>
    ipcRenderer.invoke('openclaw:agents-list'),

  listSkills: (): Promise<OpenClawCommandResult> =>
    ipcRenderer.invoke('openclaw:skills-list'),

  installSkill: (name: string): Promise<OpenClawCommandResult> =>
    ipcRenderer.invoke('openclaw:skills-install', name),

  uninstallSkill: (name: string): Promise<OpenClawCommandResult> =>
    ipcRenderer.invoke('openclaw:skills-uninstall', name),

  listBackups: (): Promise<OpenClawCommandResult> =>
    ipcRenderer.invoke('openclaw:backup-list'),

  restoreBackup: (backupId: string): Promise<OpenClawCommandResult> =>
    ipcRenderer.invoke('openclaw:backup-restore', backupId),

  createPairingCode: (): Promise<OpenClawCommandResult> =>
    ipcRenderer.invoke('openclaw:pairing-create'),

  // === Gateway ===
  getGatewayStatus: (): Promise<GatewayStatus> =>
    ipcRenderer.invoke('gateway:status'),

  restartGateway: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('gateway:restart'),

  // === Window Management ===
  showMainWindow: (): Promise<boolean> =>
    ipcRenderer.invoke('window:show-main'),

  hideMainWindow: (): Promise<boolean> =>
    ipcRenderer.invoke('window:hide-main'),

  minimizeToTray: (): Promise<boolean> =>
    ipcRenderer.invoke('window:minimize-to-tray'),

  // === BotState Push (main window → main process) ===
  pushBotState: (state: BotState): Promise<boolean> =>
    ipcRenderer.invoke('bot-state:push', state),

  // === App Info ===
  getAppInfo: (): Promise<AppInfo> =>
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

  onGatewayStatusChange: (callback: (status: GatewayStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: GatewayStatus) => callback(status);
    ipcRenderer.on('gateway:status-changed', handler);
    return () => ipcRenderer.removeListener('gateway:status-changed', handler);
  },

  // === Platform Info ===
  platform: 'windows' as const,
  isDesktop: true,

  // === Video URLs (Electron only) ===
  // Returns the base URL for video files
  getVideoBaseUrl: (): string => videoBaseUrl,
  // Returns the full URL for a specific video file
  getVideoUrl: (filename: string): string => `${videoBaseUrl}/role1/${filename}`,
};

// Type declaration for window.electronAPI
export type ElectronAPI = typeof electronAPI;

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Declare global type
export {};
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
