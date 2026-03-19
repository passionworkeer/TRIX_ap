/**
 * Shared electronAPI type declarations.
 * Imported by both preload (main process side) and renderer.
 */

export type BotState = 'IDLE' | 'THINKING' | 'SPEAKING';

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

export interface PairingQrResult {
  success: boolean;
  qrDataUrl?: string;
  code?: string;
  status?: string;
  expiresAt?: number;
  error?: string;
}

export interface PairingStatusResult {
  success: boolean;
  status?: string;
  pairedClientId?: string;
  pairedDeviceName?: string;
  error?: string;
}

export interface ElectronAPI {
  // Platform
  platform: string;
  isDesktop: boolean;
  getVideoBaseUrl: () => string;
  getVideoUrl: (filename: string) => string;

  // Window Management
  showMainWindow: () => Promise<boolean>;
  hideMainWindow: () => Promise<boolean>;
  minimizeToTray: () => Promise<boolean>;

  // Bot State
  pushBotState: (state: BotState) => Promise<boolean>;

  // OpenClaw
  checkOpenClaw: () => Promise<OpenClawStatus>;
  installOpenClaw: () => Promise<{ success: boolean; error?: string }>;
  runOpenClawDoctor: () => Promise<OpenClawCommandResult>;
  runOpenClawCommand: (cmd: string) => Promise<OpenClawCommandResult>;
  listAgents: () => Promise<OpenClawCommandResult>;
  listSkills: () => Promise<OpenClawCommandResult>;
  installSkill: (name: string) => Promise<OpenClawCommandResult>;
  uninstallSkill: (name: string) => Promise<OpenClawCommandResult>;
  listBackups: () => Promise<OpenClawCommandResult>;
  restoreBackup: (backupId: string) => Promise<OpenClawCommandResult>;
  createPairingCode: () => Promise<OpenClawCommandResult>;

  // Native Channel Pairing
  createQrCode: (label?: string) => Promise<PairingQrResult>;
  createPairingQr: (label?: string) => Promise<PairingQrResult>; // alias for createQrCode
  pollPairingStatus: (code: string) => Promise<PairingStatusResult>;

  // Gateway
  getGatewayStatus: () => Promise<GatewayStatus>;
  restartGateway: () => Promise<{ success: boolean; error?: string }>;

  // App Info
  getAppInfo: () => Promise<AppInfo>;

  // Event Listeners
  onBotStateChange: (callback: (state: BotState) => void) => () => void;
  onInstallProgress: (callback: (msg: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
