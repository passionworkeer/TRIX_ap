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

// ── Gateway WebSocket RPC types ─────────────────────────────────────────────

export interface GatewaySession {
  key: string;
  label?: string;
  status?: string;
  createdAt?: number;
  updatedAt?: number;
  messageCount?: number;
}

export interface GatewayAgent {
  id: string;
  name: string;
  status?: 'online' | 'offline' | 'alert';
  channel?: string;
  lastSeen?: number;
  source?: string;
  description?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

/** Full gateway health data from WS RPC health method */
export interface GatewayHealthData {
  ok: boolean;
  ts: number;
  durationMs: number;
  channels?: Record<string, ChannelHealthStatus>;
  channelOrder?: string[];
  channelLabels?: Record<string, string>;
  heartbeatSeconds?: number;
  defaultAgentId?: string;
  agents?: GatewayAgent[];
  sessions?: { count: number; path?: string; recent?: GatewaySession[] };
  uptimeMs?: number;
  authMode?: string;
}

export interface ChannelHealthStatus {
  configured: boolean;
  running: boolean;
  lastStartAt?: number | null;
  lastStopAt?: number | null;
  lastError?: string | null;
  port?: number | null;
  accountId?: string;
  accounts?: Record<string, { configured: boolean; running: boolean; lastError?: string | null; accountId?: string }>;
  probe?: { ok: boolean; error?: string; appId?: string; botOpenId?: string; lastProbeAt?: number };
  lastProbeAt?: number;
}

// Study Room Types
export type StudyRoomSessionState = 'idle' | 'focusing' | 'resting';
export type StudyRoomMemberStatus = 'online' | 'focusing' | 'resting';
export type StudyRoomHostAction = 'start_focus' | 'pause' | 'end';

export interface StudyRoomMember {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  joinedAt: number;
  lastActiveAt: number;
  status: StudyRoomMemberStatus;
}

export interface StudyRoomTimerState {
  durationSeconds: number;
  startedAt: number;
  endsAt: number;
  remainingSeconds: number;
}

export interface StudyRoomState {
  roomCode: string;
  hostUserId: string;
  sessionState: StudyRoomSessionState;
  members: StudyRoomMember[];
  maxMembers: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  timer: StudyRoomTimerState | null;
}

export interface StudyRoomLookupResult {
  userId: string;
  inRoom: boolean;
  roomCode?: string;
  sessionState?: StudyRoomSessionState;
  memberCount?: number;
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

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface GatewayHealthIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  layer?: 'port' | 'http' | 'cli';
}

export interface GatewayHealthLayers {
  port: { ok: boolean; pid?: number };
  http: { ok: boolean; statusCode?: number; latencyMs?: number };
  cli: { ok: boolean; version?: string; warning?: string };
}

export interface GatewayHealth {
  status: HealthStatus;
  layers: GatewayHealthLayers;
  timestamp: string;
  issues: GatewayHealthIssue[];
}

export interface LogIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: string;
  timestamp?: string;
}

export interface GatewayDiagnosis {
  type: string;
  rootCause: string;
  confidence: number;
  suggestedActions: string[];
  issues: GatewayHealthIssue[];
}

export interface KbStats {
  totalIssues: number;
  totalAttempts: number;
  successRate: number;
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

export interface TrixDesktopAttachment {
  type: 'image' | 'audio' | 'video' | 'file';
  url: string;
  name: string;
  mimeType?: string;
}

export interface TrixDesktopMessage {
  id: string;
  content: string;
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  attachments?: TrixDesktopAttachment[];
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
  windowResize: (opts: { width?: number; height?: number }) => Promise<boolean>;
  windowMove: (x: number, y: number) => Promise<boolean>;
  windowSetBounds: (bounds: { x?: number; y?: number; width?: number; height?: number }) => Promise<boolean>;
  windowGetBounds: () => Promise<{ x: number; y: number; width: number; height: number }>;
  windowMinimize: () => Promise<boolean>;
  windowMaximize: () => Promise<boolean>;
  windowIsMaximized: () => Promise<boolean>;

  // Float Window Drag
  floatMove: (x: number, y: number) => Promise<boolean>;
  floatGetPosition: () => Promise<[number, number]>;

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
  // Skill Marketplace (ClawHub)
  skillsListFull: () => Promise<SkillsListResult>;
  skillsSearch: (query: string) => Promise<ClawHubSearchResult>;
  skillsExplore: () => Promise<ClawHubExploreResult>;
  skillsClawhubInstall: (slug: string) => Promise<{ success: boolean; stdout: string; stderr: string }>;
  listBackups: () => Promise<OpenClawCommandResult>;
  restoreBackup: (backupId: string) => Promise<OpenClawCommandResult>;
  createPairingCode: () => Promise<OpenClawCommandResult>;

  // Supabase Auth
  authGetSession: () => Promise<AuthResult>;
  authSignIn: (email: string, password: string) => Promise<AuthResult>;
  authSignOut: () => Promise<ApiResult<void>>;
  authSignUp: (email: string, password: string, username?: string) => Promise<AuthResult>;
  authRefreshSession: () => Promise<AuthResult>;
  authSetSession: (sessionData: unknown) => Promise<ApiResult<void>>;
  profileUpdate: (updates: Record<string, unknown>) => Promise<ApiResult<unknown>>;

  // Study Data (Supabase — requires login, falls back gracefully)
  listTodos: () => Promise<ApiResult<Array<{ id: string; title: string; completed: boolean; priority: string; deadline?: string }>>>;
  createTodo: (title: string, priority: string) => Promise<ApiResult<{ id: string }>>;
  toggleTodo: (id: string, completed: boolean) => Promise<ApiResult<void>>;
  deleteTodo: (id: string) => Promise<ApiResult<void>>;
  getAchievements: () => Promise<ApiResult<Array<{ id: string; label: string; icon: string; earned: boolean; earnedAt?: string }>>>;
  getProfileStats: () => Promise<ApiResult<{ displayName: string; points: number; streak: number; level: number; totalStudyMinutes: number }>>;

  // Study Sessions (Supabase — requires login)
  createStudySession: (subject?: string) => Promise<ApiResult<{ id: string }>>;
  updateStudySession: (sessionId: string, duration: number) => Promise<ApiResult<void>>;
  getStudyStats: () => Promise<ApiResult<{ todayMinutes: number; weekMinutes: number; totalMinutes: number; sessionCount: number }>>;

  // Study Room (TrixNativeServer)
  createStudyRoom: (params: { userId: string; displayName: string; avatarUrl?: string; maxMembers?: number }) => Promise<ApiResult<StudyRoomState>>;
  joinStudyRoom: (roomCode: string, params: { userId: string; displayName: string; avatarUrl?: string }) => Promise<ApiResult<StudyRoomState>>;
  leaveStudyRoom: (roomCode: string, userId: string) => Promise<ApiResult<void>>;
  studyRoomHostAction: (roomCode: string, params: { userId: string; action: 'start_focus' | 'pause' | 'end'; durationMinutes?: number }) => Promise<ApiResult<StudyRoomState>>;
  getStudyRoom: (roomCode: string) => Promise<ApiResult<StudyRoomState>>;
  lookupStudyRoomsByUsers: (userIds: string[]) => Promise<ApiResult<StudyRoomLookupResult[]>>;

  // TrixNativeServer Chat API
  listConversations: () => Promise<ApiResult<Array<{ id: string; title: string; updatedAt?: string }>>>;
  fetchMessages: (conversationId: string) => Promise<ApiResult<TrixDesktopMessage[]>>;
  sendMessage: (conversationId: string, content: string) => Promise<ApiResult<TrixDesktopMessage>>;
  sendImageMessage: (
    conversationId: string,
    payload: { fileName?: string; mimeType?: string; contentBase64: string; text?: string },
  ) => Promise<ApiResult<TrixDesktopMessage>>;
  sendAttachmentMessage: (
    conversationId: string,
    payload: {
      fileName?: string;
      mimeType?: string;
      contentBase64: string;
      text?: string;
      kind?: 'image' | 'audio' | 'video' | 'file';
    },
  ) => Promise<ApiResult<TrixDesktopMessage>>;
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
  gatewayHealth: () => Promise<ApiResult<GatewayHealth>>;
  gatewayDiagnose: () => Promise<ApiResult<GatewayDiagnosis>>;
  gatewayLogsAnalyze: (opts?: { lines?: number }) => Promise<ApiResult<LogIssue[]>>;
  gatewayKbStats: () => Promise<ApiResult<KbStats>>;
  onGatewayLog: (callback: (log: string) => void) => () => void;

  // Gateway WebSocket RPC (mirrors Mission Control approach)
  /** Connect to the Gateway WebSocket channel (auto-reconnects) */
  gatewayConnect: () => Promise<{ success: boolean; error?: string }>;
  /** List agents via WS RPC */
  gatewayAgents: () => Promise<{ success: boolean; data?: GatewayAgent[]; error?: string }>;
  /** List active sessions via WS RPC */
  gatewaySessions: () => Promise<{ success: boolean; data?: GatewaySession[]; error?: string }>;
  /** Get chat history for a session */
  gatewayChatHistory: (sessionKey: string, limit?: number) => Promise<{ success: boolean; data?: ChatMessage[]; error?: string }>;
  /** Get gateway logs via WS RPC */
  gatewayLogsWs: (tail?: number) => Promise<{ success: boolean; data?: string[]; error?: string }>;
  /** Generic WS RPC call */
  gatewayRpc: (method: string, params?: Record<string, unknown>) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  /** Full gateway health via WS RPC (channels, agents, sessions count) */
  gatewayHealthRpc: () => Promise<{ success: boolean; data?: GatewayHealthData; error?: string }>;
  /** Subscribe to real-time Gateway WS events (health, heartbeat, agent, chat, etc.) — returns unsubscribe fn */
  onGatewayEvent: (callback: (event: Record<string, unknown>) => void) => () => void;

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

  // Preferences
  preferencesGet: () => Promise<ApiResult<Record<string, unknown>>>;
  preferencesSet: (prefs: Record<string, unknown>) => Promise<ApiResult<void>>;

  // Friends
  friendsList: () => Promise<ApiResult<Array<{ id: string; userId: string; displayName: string; status: string }>>>;
  friendsAdd: (friendUserId: string) => Promise<ApiResult<void>>;
  friendsAccept: (friendId: string) => Promise<ApiResult<void>>;
  friendsRemove: (friendId: string) => Promise<ApiResult<void>>;

  // Notifications
  notificationsList: () => Promise<ApiResult<Array<{ id: string; type: string; message: string; read: boolean; createdAt: string }>>>;
  notificationsMarkRead: (notificationId: string) => Promise<ApiResult<void>>;
  notificationsMarkAllRead: () => Promise<ApiResult<void>>;
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

// ── Skill Marketplace ─────────────────────────────────────────────────────────

export interface SkillInfo {
  name: string;
  description: string;
  source: string;
  bundled: boolean;    // true = built-in, cannot uninstall
  installed: boolean;  // true = user-installed (non-bundled)
  missing: boolean;    // true = missing dependencies
}

export interface ClawHubSkill {
  slug: string;
  name: string;
  description?: string;
  score?: number;
}

export interface SkillsListResult {
  success: boolean;
  data?: SkillInfo[];
  error?: string;
}

export interface ClawHubSearchResult {
  success: boolean;
  data?: ClawHubSkill[];
  error?: string;
}

export interface ClawHubExploreResult {
  success: boolean;
  data?: ClawHubSkill[];
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
