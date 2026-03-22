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

  // === TrixNativeServer Chat API ===
  listConversations: () => ipcRenderer.invoke('trixnative:conversations'),
  fetchMessages: (conversationId) => ipcRenderer.invoke('trixnative:messages', conversationId),
  sendMessage: (conversationId, content) => ipcRenderer.invoke('trixnative:send-message', conversationId, content),

  // === Native Channel Pairing ===
  createQrCode: (label) => ipcRenderer.invoke('pairing:createQr', label),
  // Aliases for backward compatibility
  createPairingQr: (label) => ipcRenderer.invoke('pairing:createQr', label),
  pollPairingStatus: (code) => ipcRenderer.invoke('pairing:pollStatus', code),

  // === Gateway ===
  getGatewayStatus: () => ipcRenderer.invoke('gateway:status'),
  restartGateway: () => ipcRenderer.invoke('gateway:restart'),

  // === App Info ===
  getAppInfo: () => ipcRenderer.invoke('app:info'),

  // === System Info (CPU / Memory / Disk / Packages) ===
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  getDiskInfo: () => ipcRenderer.invoke('system:disk'),
  checkPackages: () => ipcRenderer.invoke('system:check-packages'),

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
