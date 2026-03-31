"use strict";
const electron = require('electron');
const { contextBridge, ipcRenderer, app } = electron;

// Playwright E2E compatibility: required by playwright's electron.launch() CDP protocol
// Without this, electron.launch() times out waiting for __playwright_run() to return
globalThis.__playwright_run = async () => {
  if (!app.isReady()) {
    await new Promise((resolve) => { app.once('ready', resolve); });
  }
};

// Video path helper — works in both dev and packaged modes
function getVideoBaseUrl() {
  if (app.isPackaged) {
    // Packaged: videos are in resourcesPath
    return `file://${app.getPath('resourcesPath')}/videos`;
  }
  // Dev: serve from Vite dev server
  return 'http://localhost:5174/videos';
}

function getVideoUrl(filename) {
  return `${getVideoBaseUrl()}/role1/${filename}`;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // === Platform ===
  platform: process.platform,
  isDesktop: true,
  getVideoBaseUrl,
  getVideoUrl,

  // === Window Management ===
  showMainWindow: () => ipcRenderer.invoke('window:show-main'),
  hideMainWindow: () => ipcRenderer.invoke('window:hide-main'),
  minimizeToTray: () => ipcRenderer.invoke('window:minimize-to-tray'),
  windowResize: (opts) => ipcRenderer.invoke('window:resize', opts),
  windowMove: (x, y) => ipcRenderer.invoke('window:move', x, y),
  windowSetBounds: (bounds) => ipcRenderer.invoke('window:set-bounds', bounds),
  windowGetBounds: () => ipcRenderer.invoke('window:get-bounds'),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowIsMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  // === Float Window Drag ===
  floatMove: (x, y) => ipcRenderer.invoke('float:move', x, y),
  floatGetPosition: () => ipcRenderer.invoke('float:get-position'),

  // === Bot State ===
  pushBotState: (state) => ipcRenderer.invoke('bot-state:push', state),

  // === OpenClaw ===
  checkOpenClaw: () => ipcRenderer.invoke('openclaw:check'),
  installOpenClaw: () => ipcRenderer.invoke('openclaw:install'),
  runOpenClawDoctor: () => ipcRenderer.invoke('openclaw:doctor'),
  runOpenClawCommand: (cmd) => ipcRenderer.invoke('openclaw:run-command', cmd),
  listAgents: () => ipcRenderer.invoke('openclaw:agents-list'),
  listSkills: () => ipcRenderer.invoke('openclaw:skills-list'),
  installSkill: (name) => ipcRenderer.invoke('openclaw:skills-install', name),
  uninstallSkill: (name) => ipcRenderer.invoke('openclaw:skills-uninstall', name),
  // Skill Marketplace (ClawHub)
  skillsListFull: () => ipcRenderer.invoke('openclaw:skills-list-full'),
  skillsSearch: (query) => ipcRenderer.invoke('openclaw:skills-search', query),
  skillsExplore: () => ipcRenderer.invoke('openclaw:skills-explore'),
  skillsClawhubInstall: (slug) => ipcRenderer.invoke('openclaw:skills-clawhub-install', slug),
  listBackups: () => ipcRenderer.invoke('openclaw:backup-list'),
  restoreBackup: (id) => ipcRenderer.invoke('openclaw:backup-restore', id),
  createPairingCode: () => ipcRenderer.invoke('openclaw:pairing-create'),

  // === Gateway WebSocket RPC ===
  gatewayConnect: () => ipcRenderer.invoke('gateway:connect'),
  gatewayAgents: () => ipcRenderer.invoke('gateway:agents'),
  gatewaySessions: () => ipcRenderer.invoke('gateway:sessions'),
  gatewayChatHistory: (sessionKey, limit) => ipcRenderer.invoke('gateway:chat-history', sessionKey, limit),
  gatewayLogsWs: (tail) => ipcRenderer.invoke('gateway:logs:ws', tail),
  gatewayRpc: (method, params) => ipcRenderer.invoke('gateway:rpc', method, params),
  gatewayHealthRpc: () => ipcRenderer.invoke('gateway:health-rpc'),
  // Real-time events: returns an unsubscribe function
  onGatewayEvent: (callback) => {
    const listener = (_e, event) => callback(event);
    ipcRenderer.on('gateway:event', listener);
    return () => ipcRenderer.removeListener('gateway:event', listener);
  },

  // === Study Data (Supabase — requires login) ===
  listTodos: () => ipcRenderer.invoke('study:list-todos'),
  createTodo: (title, priority) => ipcRenderer.invoke('study:create-todo', title, priority),
  toggleTodo: (id, completed) => ipcRenderer.invoke('study:toggle-todo', id, completed),
  deleteTodo: (id) => ipcRenderer.invoke('study:delete-todo', id),
  getAchievements: () => ipcRenderer.invoke('study:get-achievements'),
  getProfileStats: () => ipcRenderer.invoke('profile:get-stats'),

  // === Study Sessions (Supabase — requires login) ===
  createStudySession: (subject) => ipcRenderer.invoke('study:create-session', subject),
  updateStudySession: (sessionId, duration) => ipcRenderer.invoke('study:update-session', sessionId, duration),
  getStudyStats: () => ipcRenderer.invoke('study:get-stats'),

  // === Study Room (TrixNativeServer) ===
  createStudyRoom: (params) => ipcRenderer.invoke('study-room:create', params),
  joinStudyRoom: (roomCode, params) => ipcRenderer.invoke('study-room:join', roomCode, params),
  leaveStudyRoom: (roomCode, userId) => ipcRenderer.invoke('study-room:leave', roomCode, userId),
  studyRoomHostAction: (roomCode, params) => ipcRenderer.invoke('study-room:host-action', roomCode, params),
  getStudyRoom: (roomCode) => ipcRenderer.invoke('study-room:get', roomCode),
  lookupStudyRoomsByUsers: (userIds) => ipcRenderer.invoke('study-room:lookup-by-users', userIds),

  // === Supabase Auth ===
  authGetSession: () => ipcRenderer.invoke('auth:get-session'),
  authSignIn: (email, password) => ipcRenderer.invoke('auth:sign-in', email, password),
  authSignOut: () => ipcRenderer.invoke('auth:sign-out'),
  authSignUp: (email, password, username) => ipcRenderer.invoke('auth:sign-up', email, password, username),
  authRefreshSession: () => ipcRenderer.invoke('auth:refresh-session'),
  authSetSession: (sessionData) => ipcRenderer.invoke('auth:set-session', sessionData),
  profileUpdate: (updates) => ipcRenderer.invoke('profile:update', updates),

  // === TrixNativeServer Chat API ===
  listConversations: () => ipcRenderer.invoke('trixnative:conversations'),
  fetchMessages: (conversationId) => ipcRenderer.invoke('trixnative:messages', conversationId),
  sendMessage: (conversationId, content) => ipcRenderer.invoke('trixnative:send-message', conversationId, content),
  sendImageMessage: (conversationId, payload) => ipcRenderer.invoke('trixnative:send-image-message', conversationId, payload),
  sendAttachmentMessage: (conversationId, payload) => ipcRenderer.invoke('trixnative:send-attachment-message', conversationId, payload),
  sendReaction: (messageId, emoji) => ipcRenderer.invoke('trixnative:send-reaction', messageId, emoji),

  // === Event Listeners ===
  onBotStateChange: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('bot-state:changed', handler);
    return () => ipcRenderer.removeListener('bot-state:changed', handler);
  },

  onTrixMessage: (callback) => {
    // Listens for new incoming TRIX messages (broadcast from main window via IPC)
    const handler = (_event, msg) => callback(msg);
    ipcRenderer.on('trixnative:new-message', handler);
    return () => ipcRenderer.removeListener('trixnative:new-message', handler);
  },
  createQrCode: (label) => ipcRenderer.invoke('pairing:createQr', label),
  // Aliases for backward compatibility
  createPairingQr: (label) => ipcRenderer.invoke('pairing:createQr', label),
  pollPairingStatus: (code) => ipcRenderer.invoke('pairing:pollStatus', code),
  pairingGenerate: () => ipcRenderer.invoke('pairing:generate'),
  pairingList: () => ipcRenderer.invoke('pairing:list'),
  pairingRevoke: (code) => ipcRenderer.invoke('pairing:revoke', code),

  // === Gateway ===
  getGatewayStatus: () => ipcRenderer.invoke('gateway:status'),
  gatewayStart: () => ipcRenderer.invoke('gateway:start'),
  gatewayStop: () => ipcRenderer.invoke('gateway:stop'),
  restartGateway: () => ipcRenderer.invoke('gateway:restart'),
  gatewayLogs: (opts) => ipcRenderer.invoke('gateway:logs', opts),
  gatewayHealth: () => ipcRenderer.invoke('gateway:health'),
  gatewayDiagnose: () => ipcRenderer.invoke('gateway:diagnose'),
  gatewayLogsAnalyze: (opts) => ipcRenderer.invoke('gateway:logs:analyze', opts),
  gatewayKbStats: () => ipcRenderer.invoke('gateway:kb:stats'),
  onGatewayLog: (callback) => {
    const handler = (_event, log) => callback(log);
    ipcRenderer.on('gateway:log', handler);
    return () => ipcRenderer.removeListener('gateway:log', handler);
  },

  // === App Info ===
  getAppInfo: () => ipcRenderer.invoke('app:info'),

  // === System Info (CPU / Memory / Disk / Packages) ===
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  getDiskInfo: () => ipcRenderer.invoke('system:disk'),
  checkPackages: () => ipcRenderer.invoke('system:check-packages'),
  getAutostart: () => ipcRenderer.invoke('system:autostart-get'),
  setAutostart: (enabled) => ipcRenderer.invoke('system:autostart-set', enabled),

  // === Third-party Channels ===
  channelsConfigure: (channel, config) => ipcRenderer.invoke('channels:configure', channel, config),
  channelsList: () => ipcRenderer.invoke('channels:list'),
  channelsDelete: (channel) => ipcRenderer.invoke('channels:delete', channel),
  channelsTest: (channel, config) => ipcRenderer.invoke('channels:test', channel, config),

  // === Third-party Channel Messaging ===
  channelsStartListening: (channel) => ipcRenderer.invoke('channels:start-listening', channel),
  channelsStopListening: (channel) => ipcRenderer.invoke('channels:stop-listening', channel),
  channelsGetMessages: (channel, opts) => ipcRenderer.invoke('channels:get-messages', channel, opts),
  channelsSendMessage: (channel, text, opts) => ipcRenderer.invoke('channels:send-message', channel, text, opts),

  onChannelMessage: (callback) => {
    const handler = (_event, msg) => callback(msg);
    ipcRenderer.on('channels:message-received', handler);
    return () => ipcRenderer.removeListener('channels:message-received', handler);
  },

  onChannelStatusUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('channels:status-update', handler);
    return () => ipcRenderer.removeListener('channels:status-update', handler);
  },

  // Event Listeners
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

  // OpenClaw Config
  configRead: () => ipcRenderer.invoke('config:read'),
  configWrite: (data) => ipcRenderer.invoke('config:write', data),
  configReadSection: (section) => ipcRenderer.invoke('config:read-section', section),
  configWriteSection: (section, value) => ipcRenderer.invoke('config:write-section', section, value),

  // Cron Jobs
  cronList: () => ipcRenderer.invoke('cron:list'),
  cronCreate: (job) => ipcRenderer.invoke('cron:create', job),
  cronUpdate: (id, updates) => ipcRenderer.invoke('cron:update', id, updates),
  cronDelete: (id) => ipcRenderer.invoke('cron:delete', id),
  cronToggle: (id, enabled) => ipcRenderer.invoke('cron:toggle', id, enabled),

  // === Preferences ===
  preferencesGet: () => ipcRenderer.invoke('preferences:get'),
  preferencesSet: (prefs) => ipcRenderer.invoke('preferences:set', prefs),

  // === Friends ===
  friendsList: () => ipcRenderer.invoke('friends:list'),
  friendsAdd: (friendUserId) => ipcRenderer.invoke('friends:add', { friendUserId }),
  friendsAccept: (friendId) => ipcRenderer.invoke('friends:accept', { friendId }),
  friendsRemove: (friendId) => ipcRenderer.invoke('friends:remove', { friendId }),

  // === Notifications ===
  notificationsList: () => ipcRenderer.invoke('notifications:list'),
  notificationsMarkRead: (notificationId) => ipcRenderer.invoke('notifications:mark-read', { notificationId }),
  notificationsMarkAllRead: () => ipcRenderer.invoke('notifications:mark-all-read'),
});
