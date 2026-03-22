"use strict";
const electron = require('electron');
const { contextBridge, ipcRenderer, app } = electron;

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
  listBackups: () => ipcRenderer.invoke('openclaw:backup-list'),
  restoreBackup: (id) => ipcRenderer.invoke('openclaw:backup-restore', id),
  createPairingCode: () => ipcRenderer.invoke('openclaw:pairing-create'),

  // === Study Data (Supabase — requires login) ===
  listTodos: () => ipcRenderer.invoke('study:list-todos'),
  createTodo: (title, priority) => ipcRenderer.invoke('study:create-todo', title, priority),
  toggleTodo: (id, completed) => ipcRenderer.invoke('study:toggle-todo', id, completed),
  deleteTodo: (id) => ipcRenderer.invoke('study:delete-todo', id),
  getAchievements: () => ipcRenderer.invoke('study:get-achievements'),
  getProfileStats: () => ipcRenderer.invoke('profile:get-stats'),

  // === Supabase Auth ===
  authGetSession: () => ipcRenderer.invoke('auth:get-session'),
  authSignIn: (email, password) => ipcRenderer.invoke('auth:sign-in', email, password),
  authSignOut: () => ipcRenderer.invoke('auth:sign-out'),
  authSignUp: (email, password) => ipcRenderer.invoke('auth:sign-up', email, password),

  // === TrixNativeServer Chat API ===
  listConversations: () => ipcRenderer.invoke('trixnative:conversations'),
  fetchMessages: (conversationId) => ipcRenderer.invoke('trixnative:messages', conversationId),
  sendMessage: (conversationId, content) => ipcRenderer.invoke('trixnative:send-message', conversationId, content),
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

  // === Event Listeners ===
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
