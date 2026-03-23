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

/** Generic success+data envelope used by TrixNativeServer API calls */
export interface ApiResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GatewayStatus {
  running: boolean;
  port?: number;
  pid?: number;
  url?: string;
  error?: string;
}

export interface GatewayLogsResult {
  success: boolean;
  data?: string[];
  error?: string;
}

export interface PairingCode {
  code: string;
  createdAt: string;
  expiresAt: string;
  claimed: boolean;
  qrDataUrl?: string;
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

  // Supabase Auth
  authGetSession: () => Promise<AuthResult>;
  authSignIn: (email: string, password: string) => Promise<AuthResult>;
  authSignOut: () => Promise<ApiResult<void>>;
  authSignUp: (email: string, password: string) => Promise<AuthResult>;

  // Study Data (Supabase — requires login, falls back gracefully)
  listTodos: () => Promise<ApiResult<Array<{ id: string; title: string; completed: boolean; priority: string; deadline?: string }>>>;
  createTodo: (title: string, priority: string) => Promise<ApiResult<{ id: string }>>;
  toggleTodo: (id: string, completed: boolean) => Promise<ApiResult<void>>;
  deleteTodo: (id: string) => Promise<ApiResult<void>>;
  getAchievements: () => Promise<ApiResult<Array<{ id: string; label: string; icon: string; earned: boolean; earnedAt?: string }>>>;
  getProfileStats: () => Promise<ApiResult<{ displayName: string; points: number; streak: number; level: number; totalStudyMinutes: number }>>;

  // TrixNativeServer Chat API
  listConversations: () => Promise<ApiResult<Array<{ id: string; title: string; updatedAt?: string }>>>;
  fetchMessages: (conversationId: string) => Promise<ApiResult<Array<{ id: string; content: string; direction: 'incoming' | 'outgoing'; timestamp: string }>>>;
  sendMessage: (conversationId: string, content: string) => Promise<ApiResult<{ id: string; content: string; direction: 'incoming' | 'outgoing'; timestamp: string }>>;
  sendReaction: (messageId: string, emoji: string) => Promise<ApiResult<void>>;

  // === System ===
  getAutostart: () => Promise<ApiResult<{ enabled: boolean }>>;
  setAutostart: (enabled: boolean) => Promise<ApiResult<void>>;
  createQrCode: (label?: string) => Promise<PairingQrResult>;
  createPairingQr: (label?: string) => Promise<PairingQrResult>; // alias for createQrCode
  pollPairingStatus: (code: string) => Promise<PairingStatusResult>;
  pairingGenerate: () => Promise<ApiResult<PairingCode>>;
  pairingList: () => Promise<ApiResult<PairingCode[]>>;
  pairingRevoke: (code: string) => Promise<ApiResult<void>>;

  // Gateway
  getGatewayStatus: () => Promise<GatewayStatus>;
  gatewayStart: () => Promise<ApiResult<{ port: number; pid?: number }>>;
  gatewayStop: () => Promise<ApiResult<void>>;
  restartGateway: () => Promise<ApiResult<{ port: number; pid?: number }>>;
  gatewayLogs: (opts?: { lines?: number }) => Promise<GatewayLogsResult>;
  onGatewayLog: (callback: (log: string) => void) => () => void;

  // App Info
  getAppInfo: () => Promise<AppInfo>;

  // System Info (CPU / Memory / Disk / Packages)
  getSystemInfo: () => Promise<SystemInfoResult>;
  getDiskInfo: () => Promise<DiskInfoResult>;
  checkPackages: () => Promise<PkgCheckResult>;

  // Third-party Channels
  channelsConfigure: (channel: string, config: Record<string, string>) => Promise<ApiResult<void>>;
  channelsList: () => Promise<ChannelListResult>;
  channelsDelete: (channel: string) => Promise<ApiResult<void>>;
  channelsTest: (channel: string, config: Record<string, string>) => Promise<ChannelTestResult>;

  // Third-party Channel Messaging
  channelsStartListening: (channel: string) => Promise<ChannelListeningResult>;
  channelsStopListening: (channel: string) => Promise<ApiResult<void>>;
  channelsGetMessages: (channel: string, opts?: { limit?: number }) => Promise<ChannelMessagesResult>;
  channelsSendMessage: (channel: string, text: string, opts?: Record<string, string>) => Promise<ChannelSendResult>;

  // Event Listeners
  onBotStateChange: (callback: (state: BotState) => void) => () => void;
  onInstallProgress: (callback: (msg: string) => void) => () => void;
  /** Fired when TRIX Native receives a new incoming message */
  onTrixMessage: (callback: (msg: { id: string; content: string; direction: 'incoming'; timestamp: string }) => void) => () => void;
  /** Fired when a third-party channel receives a new message */
  onChannelMessage: (callback: (msg: ChannelMessage) => void) => () => void;
  /** Fired when a third-party channel connection status changes */
  onChannelStatusUpdate: (callback: (data: ChannelStatusUpdate) => void) => () => void;

  // OpenClaw Config Read/Write
  configRead: () => Promise<ApiResult<Record<string, unknown>>>;
  configWrite: (data: Record<string, unknown>) => Promise<ApiResult<void>>;
  configReadSection: (section: string) => Promise<ApiResult<unknown>>;
  configWriteSection: (section: string, value: unknown) => Promise<ApiResult<void>>;

  // Cron Jobs CRUD
  cronList: () => Promise<ApiResult<unknown[]>>;
  cronCreate: (job: unknown) => Promise<ApiResult<void>>;
  cronUpdate: (id: string, updates: unknown) => Promise<ApiResult<void>>;
  cronDelete: (id: string) => Promise<ApiResult<void>>;
  cronToggle: (id: string, enabled: boolean) => Promise<ApiResult<void>>;
}

export interface SystemInfo {
  cpu: { usage: number; cores: number; model: string };
  memory: { used: number; total: number; usage: number; free: number };
  os: { hostname: string; platform: string; arch: string; version: string; release: string };
}

export interface SystemInfoResult {
  success: boolean;
  data?: SystemInfo;
  error?: string;
}

export interface DiskDrive {
  letter: string;
  total: number;
  free: number;
}

export interface DiskInfoResult {
  success: boolean;
  data?: DiskDrive[];
  error?: string;
}

export interface PkgStatus {
  name: string;
  installed: boolean;
  version?: string;
}

export interface ChannelConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  configured: boolean;
  config?: Record<string, string>;
}

export interface ChannelListResult {
  success: boolean;
  data?: ChannelConfig[];
  error?: string;
}

export interface ChannelTestResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ChannelMessage {
  id: string;
  channel: string;
  text: string;
  from: string;
  timestamp: string;
  direction: 'incoming' | 'outgoing';
  raw?: Record<string, unknown>;
}

export interface ChannelMessagesResult {
  success: boolean;
  data?: ChannelMessage[];
  error?: string;
}

export interface ChannelSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ChannelListeningResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ChannelStatusUpdate {
  channel: string;
  status: string;
  error?: string;
}

/** Supabase auth session data stored in electron-store */
export interface SupabaseSession {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: {
    id?: string;
    email?: string;
    created_at?: string;
    [key: string]: unknown;
  };
}

/** Result envelope for auth operations */
export interface AuthResult {
  success: boolean;
  data?: SupabaseSession | null;
  error?: string;
}

export interface PkgCheckResult {
  success: boolean;
  data?: PkgStatus[];
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
