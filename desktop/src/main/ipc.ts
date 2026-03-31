import { ipcMain, app } from 'electron';
import log from 'electron-log/main';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import Store from 'electron-store';
import { petStateManager } from './pet-state';
import {
  showMainWindow,
  hideMainWindow,
  minimizeToTray,
  pushBotState,
  getMainWindow,
  getFloatWindow,
} from './window-state';
import { checkOpenClaw, installOpenClaw, runCommand, skillsList, clawhubSearch, clawhubExplore, clawhubInstall } from './openclaw';
import {
  getGatewayStatus,
  restartGateway,
  startGateway,
  stopGateway,
  getGatewayLogs,
  checkGatewayHealth,
  diagnoseGateway,
  analyzeGatewayLogs,
  recordFixAttempt,
  getKbStats,
  connectGatewayWs,
  gatewayRpcCall,
  getGatewayAgents,
  getGatewaySessions,
  getChatHistory,
  getGatewayLogsWs,
  getGatewayHealthRpc,
  onGatewayEvent,
} from './gateway';

// === Input Validation Helpers ===

function isSafeString(value: unknown, maxLen = 256): string {
  if (typeof value !== 'string') throw new Error('Expected string');
  if (value.length > maxLen) throw new Error('Input too long');
  return value;
}

function isValidBotState(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected string');
  if (!['IDLE', 'THINKING', 'SPEAKING'].includes(value)) throw new Error('Invalid bot state');
  return value;
}

// === Command Allowlist for OpenClaw CLI ===

type AllowedCommand = {
  cmd: string;
  args?: string[];
  description: string;
};

const ALLOWED_COMMANDS: AllowedCommand[] = [
  { cmd: 'status', description: 'OpenClaw status' },
  { cmd: 'doctor', description: 'Health check' },
  { cmd: 'agents', args: ['list'], description: 'List agents' },
  { cmd: 'skills', args: ['list'], description: 'List skills' },
  { cmd: 'pairing', args: ['create'], description: 'Create pairing code' },
  { cmd: 'backup', args: ['list'], description: 'List backups' },
  { cmd: 'backup', args: ['create'], description: 'Create a new backup' },
];

function isAllowedCommand(fullCmd: string): boolean {
  const parts = fullCmd.trim().split(/\s+/);
  const primary = parts[0]?.toLowerCase() ?? '';
  return ALLOWED_COMMANDS.some(
    (ac) => ac.cmd === primary && (ac.args === undefined ||
      parts.slice(1).map((a) => a.toLowerCase()).join(' ') === ac.args.join(' '))
  );
}

function sanitizeSkillName(name: string): string {
  // Only allow alphanumeric, hyphen, underscore
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid skill name');
  if (name.length > 128) throw new Error('Skill name too long');
  return name;
}

function sanitizeBackupId(id: string): string {
  // Alphanumeric backup IDs
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid backup ID');
  if (id.length > 128) throw new Error('Backup ID too long');
  return id;
}

export function setupIpcHandlers(): void {
  log.info('Setting up IPC handlers...');

  // === Window Management ===
  ipcMain.handle('window:show-main', () => {
    showMainWindow();
    return true;
  });

  ipcMain.handle('window:hide-main', () => {
    hideMainWindow();
    return true;
  });

  ipcMain.handle('window:minimize-to-tray', () => {
    minimizeToTray();
    return true;
  });

  // === Main Window Resize ===
  ipcMain.handle('window:resize', (_event, opts: { width?: number; height?: number }) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      const [w = 1200, h = 800] = win.getSize();
      win.setSize(
        Math.max(opts.width ?? w, 800),
        Math.max(opts.height ?? h, 600),
      );
    }
    return true;
  });

  ipcMain.handle('window:move', (_event, x: number, y: number) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.setPosition(Math.round(x), Math.round(y));
    }
    return true;
  });

  ipcMain.handle('window:set-bounds', (_event, bounds: { x?: number; y?: number; width?: number; height?: number }) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      if (typeof bounds?.x === 'number' || typeof bounds?.y === 'number') {
        const [cx = 0, cy = 0] = win.getPosition();
        win.setPosition(Math.round(bounds.x ?? cx), Math.round(bounds.y ?? cy));
      }
      if (typeof bounds?.width === 'number' || typeof bounds?.height === 'number') {
        const [cw = 1200, ch = 800] = win.getSize();
        win.setSize(
          Math.max(Math.round(bounds.width ?? cw), 800),
          Math.max(Math.round(bounds.height ?? ch), 600),
        );
      }
    }
    return true;
  });

  ipcMain.handle('window:get-bounds', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      return win.getBounds();
    }
    return { x: 0, y: 0, width: 1200, height: 800 };
  });

  ipcMain.handle('window:minimize', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.minimize();
    }
    return true;
  });

  ipcMain.handle('window:maximize', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
    return true;
  });

  ipcMain.handle('window:is-maximized', () => {
    const win = getMainWindow();
    return win && !win.isDestroyed() ? win.isMaximized() : false;
  });

  // === Float Window Drag ===
  ipcMain.handle('float:move', (_event, x: number, y: number) => {
    const win = getFloatWindow();
    if (win && !win.isDestroyed()) {
      win.setPosition(Math.round(x), Math.round(y));
    }
    return true;
  });

  ipcMain.handle('float:get-position', () => {
    const win = getFloatWindow();
    if (win && !win.isDestroyed()) {
      return win.getPosition();
    }
    return [0, 0];
  });

  // === BotState Push (from main window to float window) ===
  ipcMain.handle('bot-state:push', (_event, state) => {
    const validated = isValidBotState(state);
    pushBotState(validated);
    return true;
  });

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    name: app.getName(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    platform: process.platform,
    userData: app.getPath('userData'),
    isPackaged: app.isPackaged,
  }));

  // === OpenClaw ===
  ipcMain.handle('openclaw:check', async () => {
    try {
      return await checkOpenClaw();
    } catch (err) {
      log.error('openclaw:check error:', err);
      return { installed: false, error: String(err) };
    }
  });

  ipcMain.handle('openclaw:install', async (event) => {
    try {
      await installOpenClaw((msg) => {
        event.sender.send('openclaw:install-progress', msg);
      });
      return { success: true };
    } catch (err) {
      log.error('openclaw:install error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('openclaw:status', async () => {
    try {
      return await runCommand('status');
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('openclaw:run-command', async (_event, cmd: string) => {
    if (!isAllowedCommand(cmd)) {
      return { success: false, stderr: 'Disallowed command' };
    }
    try {
      return await runCommand(cmd);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('openclaw:doctor', async () => {
    try {
      return await runCommand('doctor');
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('openclaw:agents-list', async () => {
    try {
      return await runCommand('agents list');
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('openclaw:skills-list', async () => {
    try {
      return await runCommand('skills list');
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('openclaw:skills-install', async (_event, skillName: string) => {
    try {
      const name = sanitizeSkillName(isSafeString(skillName, 128));
      return await runCommand(`skills install ${name}`);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('openclaw:skills-uninstall', async (_event, skillName: string) => {
    try {
      const name = sanitizeSkillName(isSafeString(skillName, 128));
      return await runCommand(`skills uninstall ${name}`);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ── Skill Marketplace (ClawHub) ───────────────────────────────────────────

  ipcMain.handle('openclaw:skills-list-full', async () => {
    try {
      return await skillsList();
    } catch (err) {
      log.error('skills-list-full error:', err);
      return { success: false, data: [], error: String(err) };
    }
  });

  ipcMain.handle('openclaw:skills-search', async (_event, query: string) => {
    try {
      const q = isSafeString(query, 128);
      if (!q.trim()) return { success: true, data: [] };
      return await clawhubSearch(q);
    } catch (err) {
      return { success: false, data: [], error: String(err) };
    }
  });

  ipcMain.handle('openclaw:skills-explore', async () => {
    try {
      return await clawhubExplore();
    } catch (err) {
      return { success: false, data: [], error: String(err) };
    }
  });

  ipcMain.handle('openclaw:skills-clawhub-install', async (_event, slug: string) => {
    try {
      const s = isSafeString(slug, 128);
      if (!/^[a-zA-Z0-9_-]+$/.test(s)) return { success: false, stdout: '', stderr: 'Invalid slug' };
      return await clawhubInstall(s);
    } catch (err) {
      return { success: false, stdout: '', stderr: String(err) };
    }
  });

  ipcMain.handle('openclaw:backup-list', async () => {
    try {
      return await runCommand('backup list');
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('openclaw:backup-restore', async (_event, backupId: string) => {
    try {
      const id = sanitizeBackupId(isSafeString(backupId, 128));
      return await runCommand(`backup restore ${id}`);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('openclaw:pairing-create', async () => {
    try {
      return await runCommand('pairing create');
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ── Supabase Auth Helpers ────────────────────────────────────────────────────

  const SUPABASE_URL = process.env.SUPABASE_URL as string | undefined;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string | undefined;

  const authStore = new Store<{ session: unknown }>({ name: 'auth', defaults: { session: null } });

  function isSupabaseConfigured(): boolean {
    return Boolean(SUPABASE_URL && SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY);
  }

  function getSession(): { access_token?: string; user?: { id?: string; email?: string; created_at?: string } } | null {
    const session = authStore.get('session');
    if (session && typeof session === 'object' && session !== null) return session as ReturnType<typeof getSession>;
    return null;
  }

  // ── Supabase Auth IPC Handlers ─────────────────────────────────────────────

  ipcMain.handle('auth:get-session', async () => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured' };
    const session = getSession();
    if (!session) return { success: false, error: 'not_authenticated' };
    return { success: true, data: session };
  });

  ipcMain.handle('auth:sign-in', async (_event, email: string, password: string) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured', data: null };
    const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
    try {
      const res = await httpRequest({
        method: 'POST',
        url,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email, password }),
      });
      const data = JSON.parse(res.body);
      if (res.statusCode !== 200) {
        const msg = typeof data?.msg === 'string' ? data.msg
          : typeof data?.error === 'string' ? data.error
          : '登录失败，请检查邮箱和密码';
        return { success: false, error: msg, data: null };
      }
      authStore.set('session', data);
      log.info('User signed in:', data.user?.email);
      return { success: true, data };
    } catch (e: unknown) {
      log.error('auth:sign-in error:', e);
      return { success: false, error: String(e), data: null };
    }
  });

  ipcMain.handle('auth:sign-out', async () => {
    authStore.delete('session');
    return { success: true };
  });

  ipcMain.handle('auth:sign-up', async (_event, email: string, password: string, username?: string) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured', data: null };
    const url = `${SUPABASE_URL}/auth/v1/signup`;
    try {
      const res = await httpRequest({
        method: 'POST',
        url,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          email,
          password,
          options: username ? { data: { username } } : {},
        }),
      });
      const data = JSON.parse(res.body);
      if (res.statusCode !== 200) {
        const msg = typeof data?.msg === 'string' ? data.msg
          : typeof data?.error === 'string' ? data.error
          : '注册失败';
        return { success: false, error: msg, data: null };
      }
      return { success: true, data };
    } catch (e: unknown) {
      log.error('auth:sign-up error:', e);
      return { success: false, error: String(e), data: null };
    }
  });

  // ── Study Data (Supabase — requires login) ─────────────────────────────────

  /** List todos for the logged-in user */
  ipcMain.handle('study:list-todos', async () => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured', data: [] };
    const session = getSession();
    if (!session?.access_token) return { success: false, error: 'not_authenticated', data: [] };
    try {
      const res = await httpRequest({
        method: 'GET',
        url: `${SUPABASE_URL}/rest/v1/todos?select=id,text:title,completed,priority,deadline,created_at&order=created_at.desc`,
        headers: {
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
          'Prefer': 'count=exact',
        },
      });
      if (res.statusCode === 200) {
        const data = JSON.parse(res.body);
        return { success: true, data: Array.isArray(data) ? data : [] };
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        authStore.delete('session');
        return { success: false, error: 'not_authenticated', data: [] };
      }
      return { success: false, error: `Server returned ${res.statusCode}`, data: [] };
    } catch (e: unknown) {
      return { success: false, error: String(e), data: [] };
    }
  });

  /** Create a new todo */
  ipcMain.handle('study:create-todo', async (_event, title: string, priority: string) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured' };
    const session = getSession();
    if (!session?.access_token) return { success: false, error: 'not_authenticated' };
    const userId = (session.user as { id?: string } | undefined)?.id;
    if (!userId) return { success: false, error: 'not_authenticated' };
    try {
      const body = JSON.stringify({ title, priority: priority || 'medium', user_id: userId });
      const res = await httpRequest({
        method: 'POST',
        url: `${SUPABASE_URL}/rest/v1/todos`,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=representation',
        },
        body,
      });
      if (res.statusCode === 201) {
        const data = JSON.parse(res.body);
        const item = Array.isArray(data) ? data[0] : data;
        return { success: true, data: { id: item?.id, title: item?.title, completed: false, priority: item?.priority } };
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        authStore.delete('session');
        return { success: false, error: 'not_authenticated' };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (e: unknown) {
      return { success: false, error: String(e) };
    }
  });

  /** Toggle todo completion */
  ipcMain.handle('study:toggle-todo', async (_event, id: string, completed: boolean) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured' };
    const session = getSession();
    if (!session?.access_token) return { success: false, error: 'not_authenticated' };
    try {
      const res = await httpRequest({
        method: 'PATCH',
        url: `${SUPABASE_URL}/rest/v1/todos?id=eq.${encodeURIComponent(id)}`,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ completed }),
      });
      if (res.statusCode === 204 || res.statusCode === 200) return { success: true };
      if (res.statusCode === 401 || res.statusCode === 403) {
        authStore.delete('session');
        return { success: false, error: 'not_authenticated' };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (e: unknown) {
      return { success: false, error: String(e) };
    }
  });

  /** Delete a todo */
  ipcMain.handle('study:delete-todo', async (_event, id: string) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured' };
    const session = getSession();
    if (!session?.access_token) return { success: false, error: 'not_authenticated' };
    try {
      const res = await httpRequest({
        method: 'DELETE',
        url: `${SUPABASE_URL}/rest/v1/todos?id=eq.${encodeURIComponent(id)}`,
        headers: {
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=minimal',
        },
      });
      if (res.statusCode === 204 || res.statusCode === 200) return { success: true };
      if (res.statusCode === 401 || res.statusCode === 403) {
        authStore.delete('session');
        return { success: false, error: 'not_authenticated' };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (e: unknown) {
      return { success: false, error: String(e) };
    }
  });

  // ── Study Sessions (Supabase — requires login) ───────────────────────────

  /** Create a study session */
  ipcMain.handle('study:create-session', async (_event, subject: string = '自习') => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured' };
    const session = getSession();
    if (!session?.access_token) return { success: false, error: 'not_authenticated' };
    const userId = (session.user as { id?: string } | undefined)?.id;
    if (!userId) return { success: false, error: 'not_authenticated' };
    try {
      const body = JSON.stringify({
        user_id: userId,
        started_at: new Date().toISOString(),
        duration: 0,
        subject
      });
      const res = await httpRequest({
        method: 'POST',
        url: `${SUPABASE_URL}/rest/v1/study_sessions`,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=representation',
        },
        body,
      });
      if (res.statusCode === 201) {
        const data = JSON.parse(res.body);
        const item = Array.isArray(data) ? data[0] : data;
        return { success: true, data: { id: item?.id } };
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        authStore.delete('session');
        return { success: false, error: 'not_authenticated' };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (e: unknown) {
      return { success: false, error: String(e) };
    }
  });

  /** Update a study session (set ended_at and duration) */
  ipcMain.handle('study:update-session', async (_event, sessionId: string, duration: number) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured' };
    const session = getSession();
    if (!session?.access_token) return { success: false, error: 'not_authenticated' };
    try {
      const body = JSON.stringify({
        ended_at: new Date().toISOString(),
        duration
      });
      const res = await httpRequest({
        method: 'PATCH',
        url: `${SUPABASE_URL}/rest/v1/study_sessions?id=eq.${encodeURIComponent(sessionId)}`,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=minimal',
        },
        body,
      });
      if (res.statusCode === 204 || res.statusCode === 200) return { success: true };
      if (res.statusCode === 401 || res.statusCode === 403) {
        authStore.delete('session');
        return { success: false, error: 'not_authenticated' };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (e: unknown) {
      return { success: false, error: String(e) };
    }
  });

  /** Get study stats (today, week, total) */
  ipcMain.handle('study:get-stats', async () => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured', data: { todayMinutes: 0, weekMinutes: 0, totalMinutes: 0, sessionCount: 0 } };
    const session = getSession();
    if (!session?.access_token) return { success: false, error: 'not_authenticated', data: { todayMinutes: 0, weekMinutes: 0, totalMinutes: 0, sessionCount: 0 } };
    const userId = (session.user as { id?: string } | undefined)?.id;
    if (!userId) return { success: false, error: 'not_authenticated', data: { todayMinutes: 0, weekMinutes: 0, totalMinutes: 0, sessionCount: 0 } };
    try {
      // Get all sessions for the user
      const res = await httpRequest({
        method: 'GET',
        url: `${SUPABASE_URL}/rest/v1/study_sessions?user_id=eq.${encodeURIComponent(userId)}&select=duration,started_at&order=started_at.desc`,
        headers: {
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
        },
      });
      if (res.statusCode === 200) {
        const sessions = JSON.parse(res.body);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 6);

        let todayMinutes = 0;
        let weekMinutes = 0;
        let totalMinutes = 0;

        for (const s of sessions) {
          const startTime = new Date(s.started_at);
          totalMinutes += s.duration || 0;
          if (startTime >= todayStart) {
            todayMinutes += s.duration || 0;
          }
          if (startTime >= weekStart) {
            weekMinutes += s.duration || 0;
          }
        }

        return {
          success: true,
          data: {
            todayMinutes,
            weekMinutes,
            totalMinutes,
            sessionCount: sessions.length
          }
        };
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        authStore.delete('session');
        return { success: false, error: 'not_authenticated', data: { todayMinutes: 0, weekMinutes: 0, totalMinutes: 0, sessionCount: 0 } };
      }
      return { success: false, error: `Server returned ${res.statusCode}`, data: { todayMinutes: 0, weekMinutes: 0, totalMinutes: 0, sessionCount: 0 } };
    } catch (e: unknown) {
      return { success: false, error: String(e), data: { todayMinutes: 0, weekMinutes: 0, totalMinutes: 0, sessionCount: 0 } };
    }
  });

  /** Get user achievements */
  ipcMain.handle('study:get-achievements', async () => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured', data: [] };
    const session = getSession();
    if (!session?.access_token) return { success: false, error: 'not_authenticated', data: [] };
    try {
      const res = await httpRequest({
        method: 'GET',
        url: `${SUPABASE_URL}/rest/v1/achievements?select=id,label,icon,earned,earned_at&order=earned_at.desc`,
        headers: {
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
        },
      });
      if (res.statusCode === 200) {
        const data = JSON.parse(res.body);
        return { success: true, data: Array.isArray(data) ? data : [] };
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        authStore.delete('session');
        return { success: false, error: 'not_authenticated', data: [] };
      }
      return { success: false, error: `Server returned ${res.statusCode}`, data: [] };
    } catch (e: unknown) {
      return { success: false, error: String(e), data: [] };
    }
  });

  /** Get user profile stats (points, streak, etc.) */
  ipcMain.handle('profile:get-stats', async () => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured', data: { displayName: 'TRIX 用户', points: 0, streak: 0, level: 1, totalStudyMinutes: 0 } };
    const session = getSession();
    if (!session?.access_token) return { success: false, error: 'not_authenticated', data: { displayName: 'TRIX 用户', points: 0, streak: 0, level: 1, totalStudyMinutes: 0 } };
    const userId = (session.user as { id?: string } | undefined)?.id;
    if (!userId) return { success: false, error: 'not_authenticated', data: { displayName: 'TRIX 用户', points: 0, streak: 0, level: 1, totalStudyMinutes: 0 } };
    try {
      const res = await httpRequest({
        method: 'GET',
        url: `${SUPABASE_URL}/rest/v1/user_stats?user_id=eq.${encodeURIComponent(userId)}&select=display_name,points,streak,level,total_study_minutes`,
        headers: {
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json',
          'Accept-Profile': 'public',
        },
      });
      if (res.statusCode === 200) {
        const data = JSON.parse(res.body);
        const stats = Array.isArray(data) ? data[0] : data;
        if (stats) {
          return {
            success: true,
            data: {
              displayName: stats.display_name || (session.user as { email?: string } | undefined)?.email?.split('@')[0] || 'TRIX 用户',
              points: stats.points ?? 0,
              streak: stats.streak ?? 0,
              level: stats.level ?? 1,
              totalStudyMinutes: stats.total_study_minutes ?? 0,
            },
          };
        }
      }
      return { success: true, data: { displayName: (session.user as { email?: string } | undefined)?.email?.split('@')[0] || 'TRIX 用户', points: 0, streak: 0, level: 1, totalStudyMinutes: 0 } };
    } catch (e: unknown) {
      return { success: false, error: String(e), data: { displayName: 'TRIX 用户', points: 0, streak: 0, level: 1, totalStudyMinutes: 0 } };
    }
  });

  /** Update user profile (display_name, bio) */
  ipcMain.handle('profile:update', async (_event, updates: Record<string, unknown>) => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured' };
    const session = getSession();
    if (!session?.access_token) return { success: false, error: 'not_authenticated' };
    const userId = (session.user as { id?: string } | undefined)?.id;
    if (!userId) return { success: false, error: 'not_authenticated' };
    try {
      const res = await httpRequest({
        method: 'PATCH',
        url: `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(updates),
      });
      if (res.statusCode === 200 || res.statusCode === 204) {
        const data = res.body && res.body !== '' ? JSON.parse(res.body) : null;
        return { success: true, data };
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        authStore.delete('session');
        return { success: false, error: 'not_authenticated' };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (e: unknown) {
      return { success: false, error: String(e) };
    }
  });

  /** Refresh the current session tokens */
  ipcMain.handle('auth:refresh-session', async () => {
    if (!isSupabaseConfigured()) return { success: false, error: 'not_configured' };
    const session = getSession();
    if (!session?.refresh_token) return { success: false, error: 'not_authenticated' };
    try {
      const res = await httpRequest({
        method: 'POST',
        url: `${SUPABASE_URL}/auth/v1/token?grant_type=refresh`,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      const data = JSON.parse(res.body);
      if (res.statusCode !== 200) {
        const msg = typeof data?.msg === 'string' ? data.msg
          : typeof data?.error === 'string' ? data.error
          : '会话刷新失败';
        return { success: false, error: msg };
      }
      authStore.set('session', data);
      return { success: true, data };
    } catch (e: unknown) {
      return { success: false, error: String(e) };
    }
  });

  type NativeChannelStateSnapshot = {
    adminToken?: string;
    serviceTokens?: Record<string, string>;
    pairings?: Array<Record<string, unknown>>;
    conversations?: Array<Record<string, unknown>>;
    messages?: Array<Record<string, unknown>>;
    studyRooms?: Array<Record<string, unknown>>;
  };

  type NativeChannelConfig = {
    accountId: string;
    serverUrl: string;
    serviceUrl: string;
    serviceToken?: string;
    adminToken?: string;
    statePath?: string;
  };

  function safeReadJsonFile(filePath: string): Record<string, unknown> | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    } catch (error) {
      log.warn('Failed to read JSON file:', filePath, error);
      return null;
    }
  }

  function toIsoString(value: unknown): string {
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return new Date(value).toISOString();
    }
    return new Date().toISOString();
  }

  function normalizeDesktopMessageDirection(direction: unknown): 'incoming' | 'outgoing' {
    const normalized = typeof direction === 'string' ? direction.toLowerCase() : '';
    return normalized === 'inbound' ? 'outgoing' : 'incoming';
  }

  function normalizeDesktopAttachmentKind(kind: unknown, mimeType: string): 'image' | 'audio' | 'video' | 'file' {
    const normalizedKind = typeof kind === 'string' ? kind.toLowerCase() : '';
    if (normalizedKind === 'image' || normalizedKind === 'audio' || normalizedKind === 'video' || normalizedKind === 'file') {
      return normalizedKind;
    }

    const normalizedMimeType = mimeType.toLowerCase();
    if (normalizedMimeType.startsWith('image/')) return 'image';
    if (normalizedMimeType.startsWith('audio/')) return 'audio';
    if (normalizedMimeType.startsWith('video/')) return 'video';
    return 'file';
  }

  function resolveDesktopAttachmentUrl(attachment: Record<string, unknown>, serverUrl: string): string {
    if (typeof attachment.url === 'string' && attachment.url.trim()) {
      return attachment.url;
    }
    if (typeof attachment.publicUrl === 'string' && attachment.publicUrl.trim()) {
      return attachment.publicUrl;
    }
    if (typeof attachment.servicePath === 'string' && attachment.servicePath.trim()) {
      return `${serverUrl.replace(/\/$/, '')}${attachment.servicePath}`;
    }
    return '';
  }

  function normalizeDesktopAttachments(entry: Record<string, unknown>, serverUrl: string) {
    const rawAttachments = Array.isArray(entry.attachments) ? entry.attachments : [];
    return rawAttachments
      .filter((attachment) => attachment && typeof attachment === 'object')
      .map((attachment) => attachment as Record<string, unknown>)
      .map((attachment) => {
        const mimeType = typeof attachment.mimeType === 'string' ? attachment.mimeType : '';
        const kind = normalizeDesktopAttachmentKind(attachment.kind, mimeType);
        const url = resolveDesktopAttachmentUrl(attachment, serverUrl);
        if (!url) {
          return null;
        }
        return {
          type: kind,
          url,
          name: typeof attachment.fileName === 'string' && attachment.fileName.trim()
            ? attachment.fileName
            : 'attachment',
          mimeType,
        };
      })
      .filter(Boolean) as Array<{
        type: 'image' | 'audio' | 'video' | 'file';
        url: string;
        name: string;
        mimeType: string;
      }>;
  }

  function normalizeDesktopMessage(entry: Record<string, unknown>, serverUrl: string) {
    const attachments = normalizeDesktopAttachments(entry, serverUrl);
    return {
      id: typeof entry.id === 'string' ? entry.id : `msg-${Date.now()}`,
      content: typeof entry.text === 'string'
        ? entry.text
        : typeof entry.content === 'string'
          ? entry.content
          : '',
      direction: normalizeDesktopMessageDirection(entry.direction),
      timestamp: toIsoString(entry.createdAt ?? entry.timestamp),
      attachments,
    };
  }

  function writeNativeChannelState(statePath: string, state: NativeChannelStateSnapshot): void {
    const tempPath = `${statePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
    fs.renameSync(tempPath, statePath);
  }

  function getNativeChannelState(config: NativeChannelConfig | null): NativeChannelStateSnapshot | null {
    if (!config?.statePath) {
      return null;
    }
    return safeReadJsonFile(config.statePath) as NativeChannelStateSnapshot | null;
  }

  function getNativeConversationClientToken(config: NativeChannelConfig, conversationId: string): string | null {
    const state = getNativeChannelState(config);
    if (!state) {
      return null;
    }

    const conversations = Array.isArray(state.conversations) ? state.conversations : [];
    const conversation = conversations
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => entry as Record<string, unknown>)
      .find((entry) => entry.id === conversationId);

    const pickTokenFromParticipants = (participants: unknown): string | null => {
      if (!Array.isArray(participants)) {
        return null;
      }

      for (const rawParticipant of participants) {
        if (!rawParticipant || typeof rawParticipant !== 'object') {
          continue;
        }
        const participant = rawParticipant as { role?: unknown; clientToken?: unknown };
        if (participant.role === 'user' && typeof participant.clientToken === 'string' && participant.clientToken.trim()) {
          return participant.clientToken.trim();
        }
      }

      for (const rawParticipant of participants) {
        if (!rawParticipant || typeof rawParticipant !== 'object') {
          continue;
        }
        const participant = rawParticipant as { clientToken?: unknown };
        if (typeof participant.clientToken === 'string' && participant.clientToken.trim()) {
          return participant.clientToken.trim();
        }
      }

      return null;
    };

    const participantToken = pickTokenFromParticipants(conversation?.participants);
    if (participantToken) {
      return participantToken;
    }

    const pairings = Array.isArray(state.pairings) ? state.pairings : [];
    const pairing = pairings
      .filter((entry) => entry && typeof entry === 'object')
      .map((entry) => entry as Record<string, unknown>)
      .find((entry) => entry.conversationId === conversationId);

    return typeof pairing?.clientToken === 'string' && pairing.clientToken.trim()
      ? pairing.clientToken.trim()
      : null;
  }

  function getNativeServiceHeaders(config: NativeChannelConfig, extra: Record<string, string> = {}): Record<string, string> | null {
    if (!config.serviceToken) {
      return null;
    }
    return {
      ...extra,
      Authorization: `Bearer ${config.serviceToken}`,
    };
  }

  function getNativeAdminHeaders(config: NativeChannelConfig, extra: Record<string, string> = {}): Record<string, string> | null {
    if (!config.adminToken) {
      return null;
    }
    return {
      ...extra,
      'x-trix-admin-token': config.adminToken,
    };
  }

  function getNativePairingHeaders(config: NativeChannelConfig, extra: Record<string, string> = {}): Record<string, string> | null {
    return getNativeServiceHeaders(config, extra) ?? getNativeAdminHeaders(config, extra);
  }

  function buildConversationTitle(conversation: Record<string, unknown>): string {
    if (typeof conversation.peerDisplayName === 'string' && conversation.peerDisplayName.trim()) {
      return conversation.peerDisplayName.trim();
    }

    const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
    for (const participant of participants) {
      if (!participant || typeof participant !== 'object') {
        continue;
      }
      const deviceName = (participant as { deviceName?: unknown }).deviceName;
      if (typeof deviceName === 'string' && deviceName.trim()) {
        return deviceName.trim();
      }
    }

    if (typeof conversation.peerId === 'string' && conversation.peerId.trim()) {
      return conversation.peerId.trim();
    }
    if (typeof conversation.pairingCode === 'string' && conversation.pairingCode.trim()) {
      return `Pairing ${conversation.pairingCode.trim()}`;
    }
    if (typeof conversation.id === 'string' && conversation.id.trim()) {
      return conversation.id.trim();
    }
    return 'Untitled Conversation';
  }

  /**
   * Get the TRIX Native service config currently used by the desktop app.
   */
  function getTrixNativeServerConfig(): NativeChannelConfig | null {
    return getNativeChannelConfig();
  }

  async function sendNativeAttachmentMessage(
    conversationId: string,
    payload: {
      fileName?: string;
      mimeType?: string;
      contentBase64?: string;
      text?: string;
      kind?: 'image' | 'audio' | 'video' | 'file';
    },
  ) {
    const contentBase64 = typeof payload?.contentBase64 === 'string' ? payload.contentBase64.trim() : '';
    if (!contentBase64) {
      return { success: false, error: 'Attachment content is required' };
    }

    const config = getTrixNativeServerConfig();
    if (!config) {
      return { success: false, error: 'TRIX Native channel not configured' };
    }

    const clientToken = getNativeConversationClientToken(config, conversationId);
    if (!clientToken) {
      return { success: false, error: 'TRIX Native client token missing for conversation' };
    }

    const mimeType = typeof payload?.mimeType === 'string' && payload.mimeType.trim()
      ? payload.mimeType.trim()
      : 'application/octet-stream';
    const fileName = typeof payload?.fileName === 'string' && payload.fileName.trim()
      ? payload.fileName.trim()
      : 'attachment.bin';
    const kind = normalizeDesktopAttachmentKind(payload?.kind, mimeType);
    const text = typeof payload?.text === 'string' ? payload.text : '';

    const res = await httpRequest({
      method: 'POST',
      url: `${config.serverUrl}/api/messages`,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        clientToken,
        text,
        attachments: [
          {
            kind,
            mimeType,
            fileName,
            contentBase64,
          },
        ],
      }),
    });

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      return { success: false, error: `Server returned ${res.statusCode}: ${res.body}` };
    }

    const data = JSON.parse(res.body) as { message?: Record<string, unknown> };
    return { success: true, data: normalizeDesktopMessage(data.message ?? {}, config.serverUrl) };
  }

  /** List all conversations for the current device */
  ipcMain.handle('trixnative:conversations', async () => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) {
        return { success: false, error: 'TRIX Native channel not configured' };
      }

      const state = getNativeChannelState(config);
      if (!state) {
        return { success: false, error: 'TRIX Native state not available' };
      }

      const conversations = Array.isArray(state.conversations) ? state.conversations : [];
      const messages = Array.isArray(state.messages) ? state.messages : [];
      const latestByConversation = new Map<string, Record<string, unknown>>();

      for (const rawMessage of messages) {
        if (!rawMessage || typeof rawMessage !== 'object') {
          continue;
        }
        const message = rawMessage as Record<string, unknown>;
        const conversationId = typeof message.conversationId === 'string' ? message.conversationId : '';
        if (!conversationId) {
          continue;
        }
        const current = latestByConversation.get(conversationId);
        const currentTs = typeof current?.createdAt === 'number' ? current.createdAt : 0;
        const nextTs = typeof message.createdAt === 'number' ? message.createdAt : 0;
        if (!current || nextTs >= currentTs) {
          latestByConversation.set(conversationId, message);
        }
      }

      const data = conversations
        .filter((rawConversation) => rawConversation && typeof rawConversation === 'object')
        .map((rawConversation) => rawConversation as Record<string, unknown>)
        .filter((conversation) => {
          const conversationAccountId = typeof conversation.accountId === 'string'
            ? conversation.accountId
            : config.accountId;
          return conversationAccountId === config.accountId;
        })
        .map((conversation) => {
          const conversationId = String(conversation.id ?? '');
          const latestMessage = latestByConversation.get(conversationId);
          const canSend = Boolean(getNativeConversationClientToken(config, conversationId));
          const updatedAt = typeof conversation.updatedAt === 'number'
            ? conversation.updatedAt
            : typeof latestMessage?.createdAt === 'number'
              ? latestMessage.createdAt
              : typeof conversation.createdAt === 'number'
                ? conversation.createdAt
                : Date.now();
          return {
            id: conversationId,
            title: buildConversationTitle(conversation),
            preview: typeof latestMessage?.text === 'string' ? latestMessage.text : '',
            updatedAt: toIsoString(updatedAt),
            canSend,
          };
        })
        .filter((conversation) => conversation.id)
        .sort((left, right) => {
          if (left.canSend !== right.canSend) {
            return left.canSend ? -1 : 1;
          }
          return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
        });

      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Fetch messages for a specific conversation */
  ipcMain.handle('trixnative:messages', async (_event, conversationId: string) => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) {
        return { success: false, error: 'TRIX Native channel not configured' };
      }
      const headers = getNativeServiceHeaders(config, { Accept: 'application/json' });
      if (!headers) {
        return { success: false, error: 'TRIX Native service token missing' };
      }

      const res = await httpRequest({
        method: 'GET',
        url: `${config.serverUrl}/api/service/conversations/${encodeURIComponent(conversationId)}`,
        headers,
      });

      if (res.statusCode !== 200) {
        return { success: false, error: `Server returned ${res.statusCode}` };
      }

      const data = JSON.parse(res.body) as { messages?: Array<Record<string, unknown>> };
      const messages = Array.isArray(data.messages)
        ? data.messages.map((message) => normalizeDesktopMessage(message, config.serverUrl))
        : [];
      return { success: true, data: messages };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Send a message to a conversation */
  ipcMain.handle('trixnative:send-message', async (_event, conversationId: string, content: string) => {
    try {
      const trimmedContent = typeof content === 'string' ? content.trim() : '';
      if (!trimmedContent) {
        return { success: false, error: 'Message content is required' };
      }

      const config = getTrixNativeServerConfig();
      if (!config) {
        return { success: false, error: 'TRIX Native channel not configured' };
      }

      const clientToken = getNativeConversationClientToken(config, conversationId);
      if (!clientToken) {
        return { success: false, error: 'TRIX Native client token missing for conversation' };
      }

      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      const res = await httpRequest({
        method: 'POST',
        url: `${config.serverUrl}/api/messages`,
        headers,
        body: JSON.stringify({
          conversationId,
          clientToken,
          text: trimmedContent,
        }),
      });

      if (res.statusCode !== 200 && res.statusCode !== 201) {
        return { success: false, error: `Server returned ${res.statusCode}: ${res.body}` };
      }

      const data = JSON.parse(res.body) as { message?: Record<string, unknown> };
      return { success: true, data: normalizeDesktopMessage(data.message ?? {}, config.serverUrl) };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Send an inline image message to a conversation */
  ipcMain.handle('trixnative:send-image-message', async (
    _event,
    conversationId: string,
    payload: { fileName?: string; mimeType?: string; contentBase64?: string; text?: string },
  ) => {
    try {
      return await sendNativeAttachmentMessage(conversationId, {
        ...payload,
        kind: 'image',
      });
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Send any inline attachment message to a conversation */
  ipcMain.handle('trixnative:send-attachment-message', async (
    _event,
    conversationId: string,
    payload: {
      fileName?: string;
      mimeType?: string;
      contentBase64?: string;
      text?: string;
      kind?: 'image' | 'audio' | 'video' | 'file';
    },
  ) => {
    try {
      return await sendNativeAttachmentMessage(conversationId, payload);
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Send a reaction emoji to a message */
  ipcMain.handle('trixnative:send-reaction', async () => {
    return { success: false, error: 'Message reactions are not supported by the current TRIX Native server' };
  });

  // === Study Room (TrixNativeServer) ===

  /** Create a study room */
  ipcMain.handle('study-room:create', async (_event, params: { userId: string; displayName: string; avatarUrl?: string; maxMembers?: number }) => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) return { success: false, error: 'TRIX Native channel not configured' };
      const headers = getNativeAdminHeaders(config, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
      if (!headers) {
        return { success: false, error: 'TRIX Native admin token unavailable' };
      }

      const res = await httpRequest({
        method: 'POST',
        url: `${config.serverUrl}/api/study-rooms`,
        headers,
        body: JSON.stringify(params),
      });

      if (res.statusCode === 201) {
        const data = JSON.parse(res.body);
        return { success: true, data: data.room };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Join a study room */
  ipcMain.handle('study-room:join', async (_event, roomCode: string, params: { userId: string; displayName: string; avatarUrl?: string }) => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) return { success: false, error: 'TRIX Native channel not configured' };
      const headers = getNativeAdminHeaders(config, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
      if (!headers) {
        return { success: false, error: 'TRIX Native admin token unavailable' };
      }

      const res = await httpRequest({
        method: 'POST',
        url: `${config.serverUrl}/api/study-rooms/${encodeURIComponent(roomCode)}/join`,
        headers,
        body: JSON.stringify(params),
      });

      if (res.statusCode === 200) {
        const data = JSON.parse(res.body);
        return { success: true, data: data.room };
      }
      if (res.statusCode === 404) {
        return { success: false, error: 'Room not found' };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Leave a study room */
  ipcMain.handle('study-room:leave', async (_event, roomCode: string, userId: string) => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) return { success: false, error: 'TRIX Native channel not configured' };
      const headers = getNativeAdminHeaders(config, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
      if (!headers) {
        return { success: false, error: 'TRIX Native admin token unavailable' };
      }

      const res = await httpRequest({
        method: 'POST',
        url: `${config.serverUrl}/api/study-rooms/${encodeURIComponent(roomCode)}/leave`,
        headers,
        body: JSON.stringify({ userId }),
      });

      if (res.statusCode === 200) {
        return { success: true };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Host action (start_focus, pause, end) */
  ipcMain.handle('study-room:host-action', async (_event, roomCode: string, params: { userId: string; action: 'start_focus' | 'pause' | 'end'; durationMinutes?: number }) => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) return { success: false, error: 'TRIX Native channel not configured' };
      const headers = getNativeAdminHeaders(config, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
      if (!headers) {
        return { success: false, error: 'TRIX Native admin token unavailable' };
      }

      const res = await httpRequest({
        method: 'POST',
        url: `${config.serverUrl}/api/study-rooms/${encodeURIComponent(roomCode)}/action`,
        headers,
        body: JSON.stringify(params),
      });

      if (res.statusCode === 200) {
        const data = JSON.parse(res.body);
        return { success: true, data: data.room };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Get study room state */
  ipcMain.handle('study-room:get', async (_event, roomCode: string) => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) return { success: false, error: 'TRIX Native channel not configured' };
      const headers = getNativeAdminHeaders(config, { Accept: 'application/json' });
      if (!headers) {
        return { success: false, error: 'TRIX Native admin token unavailable' };
      }

      const res = await httpRequest({
        method: 'GET',
        url: `${config.serverUrl}/api/study-rooms/${encodeURIComponent(roomCode)}`,
        headers,
      });

      if (res.statusCode === 200) {
        const data = JSON.parse(res.body);
        return { success: true, data: data.room };
      }
      if (res.statusCode === 404) {
        return { success: false, error: 'Room not found' };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Lookup study rooms by user IDs */
  ipcMain.handle('study-room:lookup-by-users', async (_event, userIds: string[]) => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) return { success: false, error: 'TRIX Native channel not configured' };
      const headers = getNativeAdminHeaders(config, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      });
      if (!headers) {
        return { success: false, error: 'TRIX Native admin token unavailable' };
      }

      const res = await httpRequest({
        method: 'POST',
        url: `${config.serverUrl}/api/study-rooms/lookup-by-users`,
        headers,
        body: JSON.stringify({ userIds }),
      });

      if (res.statusCode === 200) {
        const data = JSON.parse(res.body);
        return { success: true, data: data.users };
      }
      return { success: false, error: `Server returned ${res.statusCode}` };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // === Native Channel Pairing (HTTP API) ===

  function resolveNativeStateSnapshot(params: {
    openclawConfigPath: string;
    openclawConfig: Record<string, unknown>;
    accountId: string;
    account: Record<string, unknown>;
    serviceToken?: string;
  }): { statePath: string; state: NativeChannelStateSnapshot } | null {
    const candidateFiles = new Set<string>();
    const pushStateFile = (candidate: unknown) => {
      if (typeof candidate === 'string' && candidate.trim()) {
        candidateFiles.add(path.resolve(candidate.trim()));
      }
    };
    const pushStorageDir = (candidate: unknown) => {
      if (typeof candidate !== 'string' || !candidate.trim()) {
        return;
      }
      const resolved = path.resolve(candidate.trim());
      pushStateFile(path.join(resolved, 'state.json'));
      pushStateFile(path.join(resolved, 'openclaw', 'state.json'));
    };

    const pluginInstalls = params.openclawConfig.plugins && typeof params.openclawConfig.plugins === 'object'
      ? (params.openclawConfig.plugins as { installs?: Record<string, { installPath?: string; sourcePath?: string }> }).installs
      : undefined;
    const pluginInstall = pluginInstalls?.['trix-native'];
    const openclawHome = path.dirname(params.openclawConfigPath);

    const appPath = app.getAppPath();
    const localWorkspaceRoots = new Set<string>([
      appPath,
      path.resolve(appPath, '..'),
      path.resolve(appPath, '..', '..'),
      path.resolve(__dirname, '..', '..', '..'),
    ]);

    pushStorageDir(params.account.storageDir);
    for (const root of localWorkspaceRoots) {
      pushStorageDir(path.join(root, 'packages', 'trix-openclaw-native', '.trix-native-channel'));
      pushStorageDir(path.join(root, '.trix-native-channel'));
    }
    pushStorageDir(path.join(openclawHome, '.trix-native-channel'));
    pushStorageDir(path.join(openclawHome, 'extensions', 'trix-native', '.trix-native-channel'));
    pushStorageDir(path.join(openclawHome, 'extensions', 'trix-native'));
    pushStorageDir(pluginInstall?.installPath);
    if (typeof pluginInstall?.sourcePath === 'string' && pluginInstall.sourcePath.trim()) {
      const sourceRoot = path.dirname(pluginInstall.sourcePath);
      pushStorageDir(sourceRoot);
      pushStorageDir(path.join(sourceRoot, '.trix-native-channel'));
    }

    let fallback: { statePath: string; state: NativeChannelStateSnapshot } | null = null;

    for (const statePath of candidateFiles) {
      const parsed = safeReadJsonFile(statePath) as NativeChannelStateSnapshot | null;
      if (!parsed) {
        continue;
      }
      const stateToken = parsed.serviceTokens?.[params.accountId] ?? parsed.serviceTokens?.default;
      if (params.serviceToken && stateToken === params.serviceToken) {
        return { statePath, state: parsed };
      }
      if (!fallback && (parsed.adminToken || stateToken)) {
        fallback = { statePath, state: parsed };
      }
    }

    return fallback;
  }

  /**
   * Resolve the current TRIX Native service credentials from the latest
   * OpenClaw config shape, while remaining compatible with older installs.
   */
  function getNativeChannelConfig(): NativeChannelConfig | null {
    try {
      const openclawConfigPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
      const config = safeReadJsonFile(openclawConfigPath);
      if (!config) {
        log.warn('OpenClaw config not found:', openclawConfigPath);
        return null;
      }

      const trixChannel = config.channels && typeof config.channels === 'object'
        ? (config.channels as Record<string, unknown>)['trix-native']
        : undefined;
      if (!trixChannel || typeof trixChannel !== 'object') {
        log.warn('trix-native channel not configured in OpenClaw config');
        return null;
      }

      const typedChannel = trixChannel as {
        defaultAccount?: string;
        accounts?: Record<string, Record<string, unknown>>;
      };
      const accountId = typedChannel.defaultAccount ?? 'default';
      const account = typedChannel.accounts?.[accountId] ?? typedChannel.accounts?.default;
      if (!account) {
        log.warn('trix-native channel account not found in OpenClaw config');
        return null;
      }

      const serviceUrl = (typeof account.serviceUrl === 'string' && account.serviceUrl.trim())
        ? account.serviceUrl.trim()
        : (typeof account.serverUrl === 'string' && account.serverUrl.trim())
          ? account.serverUrl.trim()
          : '';
      if (!serviceUrl) {
        log.warn('trix-native channel missing serviceUrl/serverUrl');
        return null;
      }

      const configuredServiceToken = typeof account.serviceToken === 'string' && account.serviceToken.trim()
        ? account.serviceToken.trim()
        : undefined;
      const configuredAdminToken = typeof account.adminToken === 'string' && account.adminToken.trim()
        ? account.adminToken.trim()
        : undefined;

      const stateInfo = resolveNativeStateSnapshot({
        openclawConfigPath,
        openclawConfig: config,
        accountId,
        account,
        serviceToken: configuredServiceToken,
      });

      const resolvedServiceToken = configuredServiceToken
        ?? stateInfo?.state.serviceTokens?.[accountId]
        ?? stateInfo?.state.serviceTokens?.default;
      const resolvedAdminToken = configuredAdminToken ?? stateInfo?.state.adminToken;

      if (!resolvedServiceToken && !resolvedAdminToken) {
        log.warn('trix-native channel missing usable service/admin token');
        return null;
      }

      return {
        accountId,
        serverUrl: serviceUrl.replace(/\/$/, ''),
        serviceUrl: serviceUrl.replace(/\/$/, ''),
        serviceToken: resolvedServiceToken,
        adminToken: resolvedAdminToken,
        statePath: stateInfo?.statePath,
      };
    } catch (err) {
      log.error('Failed to read OpenClaw config:', err);
      return null;
    }
  }

  function httpRequest(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(options.url);
      const isHttps = urlObj.protocol === 'https:';
      const httpMod = isHttps ? https : http;
      const reqOptions: http.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method,
        headers: options.headers,
        timeout: 10000,
      };
      const req = httpMod.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  ipcMain.handle('pairing:createQr', async (_event, label?: string) => {
    try {
      const config = getNativeChannelConfig();
      if (!config) {
        return { success: false, error: 'Native channel not configured (run: openclaw config)' };
      }
      const headers = getNativePairingHeaders(config, {
        'Content-Type': 'application/json',
      });
      if (!headers) {
        return { success: false, error: 'Native channel token unavailable' };
      }

      const res = await httpRequest({
        method: 'POST',
        url: `${config.serverUrl}/api/pairings?accountId=${encodeURIComponent(config.accountId)}`,
        headers,
        body: JSON.stringify({ accountId: config.accountId, label: label ?? 'Desktop Float Window' }),
      });

      if (res.statusCode !== 201) {
        return { success: false, error: `Server returned ${res.statusCode}: ${res.body}` };
      }

      const pairing = JSON.parse(res.body);
      return {
        success: true,
        qrDataUrl: pairing.qrDataUrl,
        code: pairing.code,
        status: pairing.status,
        expiresAt: pairing.expiresAt,
      };
    } catch (err) {
      log.error('pairing:createQr error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('pairing:pollStatus', async (_event, code: string) => {
    try {
      const config = getNativeChannelConfig();
      if (!config) {
        return { success: false, error: 'Native channel not configured' };
      }
      const headers = getNativePairingHeaders(config);
      if (!headers) {
        return { success: false, error: 'Native channel token unavailable' };
      }

      const res = await httpRequest({
        method: 'GET',
        url: `${config.serverUrl}/api/pairings/${encodeURIComponent(code)}`,
        headers,
      });

      if (res.statusCode !== 200) {
        return { success: false, error: `Server returned ${res.statusCode}` };
      }

      const pairing = JSON.parse(res.body);
      return {
        success: true,
        status: pairing.status,
        pairedClientId: pairing.pairedClientId,
        pairedDeviceName: pairing.pairedDeviceName,
      };
    } catch (err) {
      log.error('pairing:pollStatus error:', err);
      return { success: false, error: String(err) };
    }
  });

  /**
   * Generate a new pairing code via TRIX Native Server.
   */
  ipcMain.handle('pairing:generate', async (_event, label?: string) => {
    try {
      const config = getNativeChannelConfig();
      if (!config) {
        return { success: false, error: 'Native channel not configured (configure TRIX Native in OpenClaw first)' };
      }
      const headers = getNativePairingHeaders(config, {
        'Content-Type': 'application/json',
      });
      if (!headers) {
        return { success: false, error: 'Native channel token unavailable' };
      }

      const res = await httpRequest({
        method: 'POST',
        url: `${config.serverUrl}/api/pairings?accountId=${encodeURIComponent(config.accountId)}`,
        headers,
        body: JSON.stringify({ accountId: config.accountId, label: label ?? 'Desktop Settings' }),
      });

      if (res.statusCode !== 201) {
        return { success: false, error: `Server returned ${res.statusCode}: ${res.body}` };
      }

      const pairing = JSON.parse(res.body);
      // Mask the code in logs — only log prefix
      log.info('Pairing code generated:', pairing.code?.slice(0, 3) + '***');
      return {
        success: true,
        data: {
          code: pairing.code,
          createdAt: toIsoString(pairing.createdAt),
          expiresAt: toIsoString(pairing.expiresAt),
          claimed: false,
          qrDataUrl: pairing.qrDataUrl,
        },
      };
    } catch (err) {
      log.error('pairing:generate error:', err);
      return { success: false, error: String(err) };
    }
  });

  /**
   * List all pairing codes from TRIX Native Server.
   */
  ipcMain.handle('pairing:list', async () => {
    try {
      const config = getNativeChannelConfig();
      if (!config) {
        return { success: false, error: 'Native channel not configured', data: [] };
      }
      const headers = getNativePairingHeaders(config, { Accept: 'application/json' });
      if (!headers) {
        return { success: false, error: 'Native channel token unavailable', data: [] };
      }

      const res = await httpRequest({
        method: 'GET',
        url: `${config.serverUrl}/api/pairings?accountId=${encodeURIComponent(config.accountId)}`,
        headers,
      });

      if (res.statusCode !== 200) {
        return { success: false, error: `Server returned ${res.statusCode}`, data: [] };
      }

      const data = JSON.parse(res.body);
      const pairings = (Array.isArray(data) ? data : []).map((p: {
        code?: string; createdAt?: string | number; expiresAt?: string | number; status?: string
      }) => ({
        code: p.code,
        createdAt: toIsoString(p.createdAt),
        expiresAt: toIsoString(p.expiresAt),
        claimed: p.status === 'paired',
      }));
      return { success: true, data: pairings };
    } catch (err) {
      log.error('pairing:list error:', err);
      return { success: false, error: String(err), data: [] };
    }
  });

  /**
   * Revoke (delete) a pairing code from TRIX Native Server.
   */
  ipcMain.handle('pairing:revoke', async (_event, code: string) => {
    try {
      const config = getNativeChannelConfig();
      if (!config) {
        return { success: false, error: 'Native channel not configured' };
      }
      // Validate input
      if (typeof code !== 'string' || !/^[A-Z0-9]+$/i.test(code) || code.length > 32) {
        return { success: false, error: 'Invalid code format' };
      }

      const state = getNativeChannelState(config);
      if (!state || !config.statePath) {
        return { success: false, error: 'Native pairing state not available' };
      }

      const normalizedCode = code.toUpperCase();
      const pairings = Array.isArray(state.pairings) ? state.pairings : [];
      const pairing = pairings.find((entry) => {
        if (!entry || typeof entry !== 'object') {
          return false;
        }
        const value = (entry as { code?: unknown }).code;
        return typeof value === 'string' && value.toUpperCase() === normalizedCode;
      }) as Record<string, unknown> | undefined;

      if (!pairing) {
        return { success: false, error: 'Pairing code not found' };
      }

      const pairedClientId = typeof pairing.pairedClientId === 'string' ? pairing.pairedClientId : undefined;
      const clientToken = typeof pairing.clientToken === 'string' ? pairing.clientToken : undefined;

      if (pairedClientId && clientToken) {
        const res = await httpRequest({
          method: 'DELETE',
          url: `${config.serverUrl}/api/pairings/${encodeURIComponent(pairedClientId)}`,
          headers: {
            'x-trix-client-token': clientToken,
          },
        });
        if (res.statusCode !== 200 && res.statusCode !== 204) {
          return { success: false, error: `Server returned ${res.statusCode}: ${res.body}` };
        }
      }

      const messages = Array.isArray(state.messages) ? state.messages : [];
      const targetConversationId = typeof pairing.conversationId === 'string' ? pairing.conversationId : undefined;
      const hasConversationMessages = Boolean(targetConversationId && messages.some((message) =>
        message && typeof message === 'object'
        && (message as { conversationId?: unknown }).conversationId === targetConversationId,
      ));
      const nextState: NativeChannelStateSnapshot = {
        ...state,
        pairings: pairings.filter((entry) =>
          !entry || typeof entry !== 'object'
          || String((entry as { code?: unknown }).code ?? '').toUpperCase() !== normalizedCode,
        ),
        conversations: Array.isArray(state.conversations)
          ? state.conversations.filter((conversation) => {
            if (!targetConversationId || !conversation || typeof conversation !== 'object') {
              return true;
            }
            if ((conversation as { id?: unknown }).id !== targetConversationId) {
              return true;
            }
            const participants = Array.isArray((conversation as { participants?: unknown }).participants)
              ? ((conversation as { participants?: unknown[] }).participants ?? [])
              : [];
            return hasConversationMessages || participants.length > 0;
          })
          : state.conversations,
      };
      writeNativeChannelState(config.statePath, nextState);

      log.info('Pairing code revoked:', code.slice(0, 3) + '***');
      return { success: true };
    } catch (err) {
      log.error('pairing:revoke error:', err);
      return { success: false, error: String(err) };
    }
  });

  // === Gateway ===
  ipcMain.handle('gateway:status', async () => {
    try {
      return await getGatewayStatus();
    } catch (err) {
      log.error('gateway:status error:', err);
      return { running: false, error: String(err) };
    }
  });

  ipcMain.handle('gateway:start', async () => {
    try {
      await startGateway();
      const status = await getGatewayStatus();
      return { success: true, data: { port: status.port, pid: status.pid } };
    } catch (err) {
      log.error('gateway:start error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('gateway:stop', async () => {
    try {
      await stopGateway();
      return { success: true };
    } catch (err) {
      log.error('gateway:stop error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('gateway:restart', async () => {
    try {
      await restartGateway();
      const status = await getGatewayStatus();
      return { success: true, data: { port: status.port, pid: status.pid } };
    } catch (err) {
      log.error('gateway:restart error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('gateway:logs', async (_event, opts?: { lines?: number }) => {
    try {
      const lines = getGatewayLogs({ lines: opts?.lines ?? 100 });
      return { success: true, data: lines };
    } catch (err) {
      return { success: false, error: String(err), data: [] };
    }
  });

  /** Triple-layer health check (port + HTTP + CLI) with 15s TTL cache */
  ipcMain.handle('gateway:health', async () => {
    try {
      const health = await checkGatewayHealth();
      return { success: true, data: health };
    } catch (err) {
      log.error('gateway:health error:', err);
      return { success: false, error: String(err) };
    }
  });

  /** Run diagnostic engine against current health + logs */
  ipcMain.handle('gateway:diagnose', async () => {
    try {
      const diagnosis = await diagnoseGateway();
      return { success: true, data: diagnosis };
    } catch (err) {
      log.error('gateway:diagnose error:', err);
      return { success: false, error: String(err) };
    }
  });

  /** Analyze gateway in-memory log buffer for error patterns */
  ipcMain.handle('gateway:logs:analyze', async (_event, opts?: { lines?: number }) => {
    try {
      const issues = analyzeGatewayLogs({ lines: opts?.lines ?? 200 });
      return { success: true, data: issues };
    } catch (err) {
      return { success: false, error: String(err), data: [] };
    }
  });

  /** Knowledge base stats */
  ipcMain.handle('gateway:kb:stats', async () => {
    try {
      const stats = getKbStats();
      return { success: true, data: stats };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Record a fix attempt for learning */
  ipcMain.handle('gateway:kb:record', async (
    _event,
    issueType: string,
    solution: string,
    success: boolean,
    durationMs: number
  ) => {
    try {
      recordFixAttempt(issueType, solution, success, durationMs);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // === System Info (CPU / Memory / Disk) ===
  ipcMain.handle('system:info', async () => {
    try {
      // CPU usage — sample idle vs total ticks
      const cpus = os.cpus();
      let totalIdle = 0, totalTick = 0;
      for (const cpu of cpus) {
        for (const type in cpu.times) {
          // @ts-ignore
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      }
      const cpuUsage = totalTick > 0
        ? Math.round((1 - totalIdle / totalTick) * 100)
        : 0;

      // Memory
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsage = Math.round((usedMem / totalMem) * 100);

      // Platform info
      const hostname = os.hostname();
      const platform = os.platform(); // 'win32' | 'darwin' | 'linux'
      const arch = os.arch();        // 'x64' | 'arm64' | etc.
      const release = os.release();   // OS version string
      const cpusCount = os.cpus().length;
      const cpuModel = cpus[0]?.model ?? 'Unknown';

      // Get Windows version via PowerShell
      let osVersion = release;
      if (platform === 'win32') {
        try {
          const { stdout } = await promisify(exec)(
            'powershell -Command "(Get-CimInstance Win32_OperatingSystem).Caption"',
            { encoding: 'utf8', timeout: 5000 }
          );
          osVersion = stdout.trim();
        } catch {
          // ignore — keep release string
        }
      }

      return {
        success: true,
        data: {
          cpu: {
            usage: cpuUsage,
            cores: cpusCount,
            model: cpuModel,
          },
          memory: {
            used: Math.round(usedMem / 1024 / 1024 / 1024 * 10) / 10,  // GB
            total: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10,
            usage: memUsage,
            free: Math.round(freeMem / 1024 / 1024 / 1024 * 10) / 10,
          },
          os: {
            hostname,
            platform,
            arch,
            version: osVersion,
            release,
          },
        },
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // === Disk Info ===
  ipcMain.handle('system:disk', async () => {
    if (os.platform() === 'win32') {
      try {
        const { stdout } = await promisify(exec)(
          'powershell -Command "Get-CimInstance Win32_LogicalDisk -Filter \\"DriveType=3\\" | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json"',
          { encoding: 'utf8', timeout: 10000 }
        );
        const parsed = JSON.parse(stdout);
        const drives = (Array.isArray(parsed) ? parsed : [parsed]).map((d: { DeviceID: string; Size: string; FreeSpace: string }) => ({
          letter: d.DeviceID,
          total: Math.round(Number(d.Size) / 1024 / 1024 / 1024),
          free: Math.round(Number(d.FreeSpace) / 1024 / 1024 / 1024),
        }));
        return { success: true, data: drives };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
    // macOS / Linux fallback
    try {
      const { stdout } = await promisify(exec)(
        "df -h --output=target,size,avail | tail -n +2",
        { encoding: 'utf8', timeout: 5000 }
      );
      const drives = stdout.split('\n').filter(Boolean).map((line: string) => {
        const parts = line.trim().split(/\s+/);
        return { letter: parts[0], total: parts[1] ?? '—', free: parts[2] ?? '—' };
      });
      return { success: true, data: drives };
    } catch {
      return { success: false, error: 'Unsupported platform', data: [] };
    }
  });

  // === Check installed npm packages ===
  ipcMain.handle('system:check-packages', async () => {
    try {
      const packages = [
        'openclaw',
        'pnpm',
        'npm',
        'node',
        '@anthropic-ai/sdk',
        'typescript',
        'vite',
        'electron',
      ];

      const results = await Promise.all(
        packages.map(async (pkg) => {
          try {
            const { stdout } = await promisify(exec)(
              `npm list -g --depth=0 "${pkg}" 2>nul`,
              { encoding: 'utf8', timeout: 8000 }
            );
            const out = stdout.trim();
            const match = out.match(new RegExp(`${pkg}[/@][^\\s]*`, 'i'));
            const version = match ? (match[0].split('@').pop() ?? '?') : null;
            return { name: pkg, installed: !!version, version: version ?? undefined };
          } catch {
            return { name: pkg, installed: false };
          }
        })
      );

      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: String(err), data: [] };
    }
  });

  // === Third-party Channel Configuration (electron-store) =====================

  interface ChannelStoreSchema {
    channels: Record<string, {
      enabled: boolean;
      config: Record<string, string>;
    }>;
  }

  const channelStore = new Store<ChannelStoreSchema>({
    name: 'channels',
    defaults: { channels: {} },
  });

  const KNOWN_CHANNELS = [
    { id: 'telegram', name: 'Telegram', requiredFields: ['botToken'] },
    { id: 'feishu',   name: '飞书',      requiredFields: ['appId', 'appSecret'] },
    { id: 'discord',  name: 'Discord',   requiredFields: ['webhookUrl'] },
    { id: 'slack',    name: 'Slack',     requiredFields: ['webhookUrl'] },
    { id: 'whatsapp', name: 'WhatsApp',  requiredFields: ['phoneNumber', 'instanceId', 'apiToken'] },
    { id: 'wecom',    name: '企业微信',  requiredFields: ['webhookUrl', 'corpId', 'agentId'] },
  ] as const;

  /** Validate channel ID against the allowlist */
  function isKnownChannel(id: unknown): id is string {
    return typeof id === 'string' && KNOWN_CHANNELS.some((c) => c.id === id);
  }

  /** Validate config object has no prototype pollution risk */
  function sanitizeConfig(raw: unknown): Record<string, string> {
    if (typeof raw !== 'object' || raw === null) throw new Error('Config must be an object');
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof k !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k)) continue;
      if (typeof v !== 'string') continue;
      if (v.length > 512) continue;
      result[k] = v;
    }
    return result;
  }

  /** Persist channel config */
  ipcMain.handle('channels:configure', async (_event, channelId: unknown, config: unknown) => {
    try {
      if (!isKnownChannel(channelId)) return { success: false, error: 'Unknown channel' };
      const cleanConfig = sanitizeConfig(config);
      const channels = channelStore.get('channels');
      channels[channelId] = { enabled: true, config: cleanConfig };
      channelStore.set('channels', channels);
      log.info(`Channel configured: ${channelId}`);
      return { success: true };
    } catch (err) {
      log.error('channels:configure error:', err);
      return { success: false, error: String(err) };
    }
  });

  /** List all known channels with their configured state */
  ipcMain.handle('channels:list', async () => {
    try {
      const stored = channelStore.get('channels');
      const list = KNOWN_CHANNELS.map((ch) => {
        const saved = stored[ch.id];
        return {
          id: ch.id,
          name: ch.name,
          type: ch.id,
          enabled: saved?.enabled ?? false,
          configured: saved != null && Object.keys(saved.config ?? {}).length > 0,
          config: saved?.config,
        };
      });
      return { success: true, data: list };
    } catch (err) {
      log.error('channels:list error:', err);
      return { success: false, error: String(err), data: [] };
    }
  });

  /** Delete a channel config */
  ipcMain.handle('channels:delete', async (_event, channelId: unknown) => {
    try {
      if (!isKnownChannel(channelId)) return { success: false, error: 'Unknown channel' };
      const channels = channelStore.get('channels');
      delete channels[channelId];
      channelStore.set('channels', channels);
      log.info(`Channel deleted: ${channelId}`);
      return { success: true };
    } catch (err) {
      log.error('channels:delete error:', err);
      return { success: false, error: String(err) };
    }
  });

  /**
   * Test channel connectivity (read-only validation, no side effects).
   * Telegram: GET https://api.telegram.org/bot<token>/getMe
   * Feishu: POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal
   * Discord/Slack/WeCom: HEAD request to webhook URL (validates URL is reachable)
   * WhatsApp: validates token presence only (real API requires paid key)
   */
  ipcMain.handle('channels:test', async (_event, channelId: unknown, config: unknown) => {
    try {
      if (!isKnownChannel(channelId)) return { success: false, error: 'Unknown channel' };
      const cfg = sanitizeConfig(config);

      if (channelId === 'telegram') {
        const token = cfg['botToken'];
        if (!token) return { success: false, message: '缺少 Bot Token' };
        const res = await httpRequest({
          method: 'GET',
          url: `https://api.telegram.org/bot${token}/getMe`,
        });
        if (res.statusCode === 200) {
          return { success: true, message: 'Bot Token 验证成功' };
        }
        return { success: false, message: `验证失败: ${res.statusCode}` };
      }

      if (channelId === 'feishu') {
        const appId = cfg['appId'];
        const appSecret = cfg['appSecret'];
        if (!appId || !appSecret) return { success: false, message: '缺少 App ID 或 App Secret' };
        const res = await httpRequest({
          method: 'POST',
          url: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
        });
        if (res.statusCode === 200) {
          return { success: true, message: '飞书凭证验证成功' };
        }
        return { success: false, message: `验证失败: ${res.statusCode}` };
      }

      if (channelId === 'discord' || channelId === 'slack' || channelId === 'wecom') {
        const webhookUrl = cfg['webhookUrl'];
        if (!webhookUrl) return { success: false, message: '缺少 Webhook URL' };
        const res = await httpRequest({ method: 'HEAD', url: webhookUrl });
        if (res.statusCode >= 200 && res.statusCode < 400) {
          return { success: true, message: 'Webhook URL 可达' };
        }
        return { success: false, message: `Webhook URL 返回 ${res.statusCode}` };
      }

      if (channelId === 'whatsapp') {
        if (!cfg['apiToken']) return { success: false, message: '缺少 API Token' };
        return { success: true, message: 'WhatsApp 凭证格式正确' };
      }

      return { success: false, message: '不支持的渠道' };
    } catch (err) {
      log.error('channels:test error:', err);
      return { success: false, error: String(err) };
    }
  });

  // === Third-party Channel Messaging =========================================

  // ── Types ──────────────────────────────────────────────────────────────────
  interface ChannelMessage {
    id: string;
    channel: string;
    text: string;
    from: string;
    timestamp: string;
    direction: 'incoming' | 'outgoing';
    raw?: Record<string, unknown>;
  }

  // ── In-memory store per channel ────────────────────────────────────────────
  const messageStore: Map<string, ChannelMessage[]> = new Map();
  const listenerState: Map<string, {
    timer?: ReturnType<typeof setTimeout>;
    ws?: unknown;
    stopRequested?: boolean;
  }> = new Map();

  function pushToRenderer(_channel: string, msg: ChannelMessage): void {
    // Update pet state based on message direction
    if (msg.direction === 'incoming') {
      petStateManager.onInboundMessage();
    } else {
      petStateManager.onAiSpeaking();
    }

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('channels:message-received', msg);
    }
    // Also push to float window
    const floatWin = getFloatWindow();
    if (floatWin && !floatWin.isDestroyed()) {
      floatWin.webContents.send('channels:message-received', msg);
    }
  }

  function pushStatusToRenderer(channel: string, status: string, error?: string): void {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('channels:status-update', { channel, status, error });
    }
  }

  function appendMessage(channel: string, msg: ChannelMessage): void {
    const existing = messageStore.get(channel) ?? [];
    existing.push(msg);
    if (existing.length > 100) existing.splice(0, existing.length - 100);
    messageStore.set(channel, existing);
    pushToRenderer(channel, msg);
  }

  function stopListener(channel: string): void {
    const state = listenerState.get(channel);
    if (!state) return;
    if (state.timer) { clearTimeout(state.timer); }
    listenerState.delete(channel);
    // Note: ws close handled by the individual listener functions
  }

  // ── Telegram: long-polling getUpdates ─────────────────────────────────────

  function startTelegramListener(botToken: string): void {
    let offset = 0;
    let active = true;

    const poll = async (): Promise<void> => {
      if (!active) return;
      try {
        const res = await httpRequest({
          method: 'GET',
          url: `https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=55&allowed_updates=messages`,
        });
        if (res.statusCode !== 200) {
          pushStatusToRenderer('telegram', 'error', `HTTP ${res.statusCode}`);
          scheduleNext();
          return;
        }
        const data = JSON.parse(res.body);
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result as Array<{
            message?: {
              message_id: number; from?: { first_name: string };
              chat: { title?: string; username?: string }; text?: string; date: number;
            };
          }>) {
            const msg = update.message;
            if (!msg) continue;
            const from = msg.from?.first_name ?? msg.chat?.title ?? msg.chat?.username ?? 'Unknown';
            appendMessage('telegram', {
              id: `${msg.message_id}`, channel: 'telegram',
              text: msg.text ?? '', from,
              timestamp: new Date(msg.date * 1000).toISOString(),
              direction: 'incoming',
            });
            offset = Math.max(offset, msg.message_id + 1);
          }
        }
        pushStatusToRenderer('telegram', 'connected');
      } catch (err) {
        log.warn('Telegram poll error:', err);
        pushStatusToRenderer('telegram', 'error', String(err));
      }
      scheduleNext();
    };

    function scheduleNext(): void {
      if (!active) return;
      const state = listenerState.get('telegram');
      if (state) { state.timer = setTimeout(poll, 10_000); }
    }

    poll();

    // Store stop-flag on the listener state
    const state = listenerState.get('telegram');
    if (state) {
      // Override stopRequested getter by tracking active flag
      void active; // captured in closure; stopListener sets active=false via listenerState
    }
  }

  // ── Feishu: WebSocket real-time events ────────────────────────────────────

  async function startFeishuListener(appId: string, appSecret: string): Promise<void> {
    try {
      // Step 1: get tenant access token
      const tokenRes = await httpRequest({
        method: 'POST',
        url: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      });
      if (tokenRes.statusCode !== 200) {
        pushStatusToRenderer('feishu', 'error', `Auth failed: ${tokenRes.statusCode}`);
        return;
      }
      const tData = JSON.parse(tokenRes.body);
      const wsToken = tData.tenant_access_token as string | undefined;
      if (!wsToken) { pushStatusToRenderer('feishu', 'error', 'No access token'); return; }

      // Step 2: HTTP polling fallback (30s) since wss:// requires the Feishu SDK
      startFeishuPolling(wsToken);
    } catch (err) {
      log.error('Feishu listener error:', err);
      pushStatusToRenderer('feishu', 'error', String(err));
    }
  }

  function startFeishuPolling(accessToken: string): void {
    let active = true;
    let lastMsgTime = 0;

    const poll = async (): Promise<void> => {
      if (!active) return;
      try {
        const res = await httpRequest({
          method: 'GET',
          url: 'https://open.feishu.cn/open-apis/im/v1/messages?page_size=20',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.statusCode === 200) {
          pushStatusToRenderer('feishu', 'connected');
          try {
            const data = JSON.parse(res.body);
            const items: Array<{
              message_id?: string; create_time?: string;
              sender?: { id?: string; name?: string; sender_type?: string };
              body?: { content?: string };
            }> = Array.isArray(data.data?.items) ? data.data.items : [];
            for (const item of items) {
              const msgTime = Number(item.create_time) || 0;
              if (msgTime <= lastMsgTime) continue;
              lastMsgTime = Math.max(lastMsgTime, msgTime);
              const isBot = item.sender?.sender_type === 'bot';
              appendMessage('feishu', {
                id: item.message_id ?? `feishu-${msgTime}`,
                channel: 'feishu',
                text: item.body?.content ?? '',
                from: isBot ? 'You' : (item.sender?.name ?? '飞书用户'),
                timestamp: msgTime ? new Date(msgTime).toISOString() : new Date().toISOString(),
                direction: isBot ? 'outgoing' : 'incoming',
              });
            }
          } catch { /* ignore parse errors */ }
        } else {
          pushStatusToRenderer('feishu', 'error', `HTTP ${res.statusCode}`);
        }
      } catch (err) {
        pushStatusToRenderer('feishu', 'error', String(err));
      }
      if (active) {
        const state = listenerState.get('feishu');
        if (state) state.timer = setTimeout(poll, 30_000);
      }
    };

    pushStatusToRenderer('feishu', 'connected');
    poll();
  }

  // ── Webhook channels: 30s polling stub ───────────────────────────────────

  function startWebhookPoll(channel: string, webhookUrl: string): void {
    const poll = async (): Promise<void> => {
      try {
        const res = await httpRequest({ method: 'GET', url: webhookUrl });
        if (res.statusCode === 200) {
          pushStatusToRenderer(channel, 'connected');
          try {
            const data = JSON.parse(res.body);
            const msgs: Array<{
              id?: string; content?: string; author?: { username?: string }; timestamp?: string;
            }> = Array.isArray(data) ? data : [data];
            for (const item of msgs) {
              if (!item.content) continue;
              appendMessage(channel, {
                id: item.id ?? `${Date.now()}-${Math.random()}`,
                channel,
                text: item.content,
                from: item.author?.username ?? channel,
                timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
                direction: 'incoming',
              });
            }
          } catch { /* non-JSON response */ }
        } else {
          pushStatusToRenderer(channel, 'error', `HTTP ${res.statusCode}`);
        }
      } catch (err) {
        pushStatusToRenderer(channel, 'error', String(err));
      }
      const state = listenerState.get(channel);
      if (state) state.timer = setTimeout(poll, 30_000);
    };

    pushStatusToRenderer(channel, 'connected', 'experimental: 30s轮询模式');
    poll();
  }

  // ── IPC Handlers ───────────────────────────────────────────────────────────

  ipcMain.handle('channels:start-listening', async (_event, channelId: unknown) => {
    try {
      if (!isKnownChannel(channelId)) return { success: false, error: 'Unknown channel' };
      const stored = channelStore.get('channels')[channelId as string];
      if (!stored) return { success: false, error: 'Channel not configured' };

      stopListener(channelId as string);
      listenerState.set(channelId as string, { stopRequested: false });
      const cfg = stored.config;

      if (channelId === 'telegram') {
        const token = cfg['botToken'];
        if (!token) return { success: false, error: 'Bot Token not configured' };
        startTelegramListener(token);
        return { success: true, message: 'started' };
      }

      if (channelId === 'feishu') {
        const appId = cfg['appId'];
        const appSecret = cfg['appSecret'];
        if (!appId || !appSecret) return { success: false, error: 'App ID or App Secret not configured' };
        await startFeishuListener(appId, appSecret);
        return { success: true, message: 'started' };
      }

      if (channelId === 'discord' || channelId === 'slack' || channelId === 'wecom') {
        const webhookUrl = cfg['webhookUrl'];
        if (!webhookUrl) return { success: false, error: 'Webhook URL not configured' };
        startWebhookPoll(channelId as string, webhookUrl);
        return { success: true, message: 'started (experimental, 30s polling)' };
      }

      if (channelId === 'whatsapp') {
        pushStatusToRenderer('whatsapp', 'connected', 'experimental: manual refresh only');
        return { success: true, message: 'WhatsApp — paid API required for listening' };
      }

      return { success: false, error: 'Unsupported channel' };
    } catch (err) {
      log.error('channels:start-listening error:', err);
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('channels:stop-listening', async (_event, channelId: unknown) => {
    try {
      if (!isKnownChannel(channelId)) return { success: false, error: 'Unknown channel' };
      const state = listenerState.get(channelId as string);
      if (state) { state.stopRequested = true; }
      stopListener(channelId as string);
      pushStatusToRenderer(channelId as string, 'disconnected');
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('channels:get-messages', async (_event, channelId: unknown, opts?: { limit?: number }) => {
    try {
      if (!isKnownChannel(channelId)) return { success: false, error: 'Unknown channel', data: [] };
      const msgs = messageStore.get(channelId as string) ?? [];
      const limit = Math.min(opts?.limit ?? 20, 100);
      return { success: true, data: msgs.slice(-limit) };
    } catch (err) {
      return { success: false, error: String(err), data: [] };
    }
  });

  ipcMain.handle('channels:send-message', async (_event, channelId: unknown, text: string, _opts?: Record<string, string>) => {
    try {
      if (!isKnownChannel(channelId)) return { success: false, error: 'Unknown channel' };
      if (typeof text !== 'string' || !text.trim()) return { success: false, error: 'Empty message' };
      const stored = channelStore.get('channels')[channelId as string];
      if (!stored) return { success: false, error: 'Channel not configured' };
      const cfg = stored.config;
      const outMsgId = `local-${Date.now()}`;

      if (channelId === 'telegram') {
        const token = cfg['botToken'];
        const chatId = cfg['chatId'];
        if (!token) return { success: false, error: 'Bot Token not configured' };
        const body = JSON.stringify({ chat_id: chatId ?? 'me', text: text.trim() });
        const res = await httpRequest({ method: 'POST', url: `https://api.telegram.org/bot${token}/sendMessage`, headers: { 'Content-Type': 'application/json' }, body });
        if (res.statusCode !== 200) return { success: false, error: `Telegram API ${res.statusCode}` };
        const data = JSON.parse(res.body);
        const sentId = String(data.result?.message_id ?? outMsgId);
        appendMessage('telegram', { id: sentId, channel: 'telegram', text: text.trim(), from: 'You', timestamp: new Date().toISOString(), direction: 'outgoing' });
        return { success: true, messageId: sentId };
      }

      if (channelId === 'feishu') {
        const appId = cfg['appId'];
        const appSecret = cfg['appSecret'];
        if (!appId || !appSecret) return { success: false, error: 'App ID or App Secret not configured' };
        const tokenRes = await httpRequest({ method: 'POST', url: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app_id: appId, app_secret: appSecret }) });
        if (tokenRes.statusCode !== 200) return { success: false, error: 'Feishu auth failed' };
        const tData = JSON.parse(tokenRes.body);
        const feishuToken = tData.tenant_access_token as string | undefined;
        if (!feishuToken) return { success: false, error: 'No Feishu access token' };
        const receiveId = cfg['receiveId'] ?? '';
        const sendBody = JSON.stringify({ receive_id: receiveId, msg_type: 'text', content: JSON.stringify({ text: text.trim() }) });
        const sendRes = await httpRequest({ method: 'POST', url: 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${feishuToken}` }, body: sendBody });
        if (sendRes.statusCode !== 200 && sendRes.statusCode !== 201) return { success: false, error: `Feishu API ${sendRes.statusCode}` };
        const sData = JSON.parse(sendRes.body);
        const sentId = String(sData.data?.message_id ?? outMsgId);
        appendMessage('feishu', { id: sentId, channel: 'feishu', text: text.trim(), from: 'You', timestamp: new Date().toISOString(), direction: 'outgoing' });
        return { success: true, messageId: sentId };
      }

      if (channelId === 'discord') {
        const webhookUrl = cfg['webhookUrl'];
        if (!webhookUrl) return { success: false, error: 'Webhook URL not configured' };
        const body = JSON.stringify({ content: text.trim() });
        const res = await httpRequest({ method: 'POST', url: webhookUrl, headers: { 'Content-Type': 'application/json' }, body });
        if (res.statusCode !== 200 && res.statusCode !== 204) return { success: false, error: `Discord ${res.statusCode}` };
        appendMessage('discord', { id: outMsgId, channel: 'discord', text: text.trim(), from: 'You', timestamp: new Date().toISOString(), direction: 'outgoing' });
        return { success: true, messageId: outMsgId };
      }

      if (channelId === 'slack') {
        const webhookUrl = cfg['webhookUrl'];
        if (!webhookUrl) return { success: false, error: 'Webhook URL not configured' };
        const body = JSON.stringify({ text: text.trim() });
        const res = await httpRequest({ method: 'POST', url: webhookUrl, headers: { 'Content-Type': 'application/json' }, body });
        if (res.statusCode !== 200) return { success: false, error: `Slack ${res.statusCode}` };
        appendMessage('slack', { id: outMsgId, channel: 'slack', text: text.trim(), from: 'You', timestamp: new Date().toISOString(), direction: 'outgoing' });
        return { success: true, messageId: outMsgId };
      }

      if (channelId === 'wecom') {
        const webhookUrl = cfg['webhookUrl'];
        if (!webhookUrl) return { success: false, error: 'Webhook URL not configured' };
        const body = JSON.stringify({ msgtype: 'text', text: { content: text.trim() } });
        const res = await httpRequest({ method: 'POST', url: webhookUrl, headers: { 'Content-Type': 'application/json' }, body });
        if (res.statusCode !== 200) return { success: false, error: `WeCom ${res.statusCode}` };
        const wData = JSON.parse(res.body);
        if (wData.errcode !== 0) return { success: false, error: wData.errmsg ?? 'WeCom error' };
        const sentId = String(wData.msgid ?? outMsgId);
        appendMessage('wecom', { id: sentId, channel: 'wecom', text: text.trim(), from: 'You', timestamp: new Date().toISOString(), direction: 'outgoing' });
        return { success: true, messageId: sentId };
      }

      if (channelId === 'whatsapp') {
        const instanceId = cfg['instanceId'];
        const apiToken = cfg['apiToken'];
        const phoneNumber = cfg['phoneNumber'];
        if (!instanceId || !apiToken) return { success: false, error: 'WhatsApp credentials not configured' };
        const waUrl = `https://api.ultramsg.com/instance${instanceId}/messages/chat`;
        const body = new URLSearchParams({ token: apiToken, to: phoneNumber ?? '', body: text.trim() }).toString();
        const res = await httpRequest({ method: 'POST', url: waUrl, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        if (res.statusCode !== 200 && res.statusCode !== 201) return { success: false, error: `WhatsApp API ${res.statusCode}` };
        appendMessage('whatsapp', { id: outMsgId, channel: 'whatsapp', text: text.trim(), from: 'You', timestamp: new Date().toISOString(), direction: 'outgoing' });
        return { success: true, messageId: outMsgId };
      }

      return { success: false, error: 'Unsupported channel' };
    } catch (err) {
      log.error('channels:send-message error:', err);
      return { success: false, error: String(err) };
    }
  });

  // ── Config Read/Write ──────────────────────────────────────────────────────
  // Reads the raw openclaw.json file
  ipcMain.handle('config:read', async () => {
    try {
      const cfgPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
      const raw = await fs.promises.readFile(cfgPath, 'utf-8');
      return { success: true, data: JSON.parse(raw) };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  // Writes the raw openclaw.json file (full replacement)
  ipcMain.handle('config:write', async (_event, data: unknown) => {
    try {
      if (typeof data !== 'object' || data === null) return { success: false, error: 'Expected object' };
      const cfgPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
      await fs.promises.writeFile(cfgPath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  // Reads a single top-level section from openclaw.json
  ipcMain.handle('config:read-section', async (_event, section: unknown) => {
    try {
      const s = isSafeString(section, 64);
      const cfgPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
      const raw = await fs.promises.readFile(cfgPath, 'utf-8');
      const cfg = JSON.parse(raw);
      if (cfg[s] === undefined) return { success: false, error: `Section '${s}' not found` };
      return { success: true, data: cfg[s] };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  // Writes a single top-level section into openclaw.json (deep merge)
  ipcMain.handle('config:write-section', async (_event, section: unknown, value: unknown) => {
    try {
      const s = isSafeString(section, 64);
      if (typeof value !== 'object' || value === null) return { success: false, error: 'Expected object value' };
      const cfgPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
      const raw = await fs.promises.readFile(cfgPath, 'utf-8');
      const cfg = JSON.parse(raw);
      cfg[s] = value;
      await fs.promises.writeFile(cfgPath, JSON.stringify(cfg, null, 2), 'utf-8');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  // ── Cron Jobs ──────────────────────────────────────────────────────────────
  // Lists all cron jobs
  ipcMain.handle('cron:list', async () => {
    try {
      const cronPath = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json');
      const raw = await fs.promises.readFile(cronPath, 'utf-8');
      return { success: true, data: JSON.parse(raw) };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  // Creates a new cron job (appends to jobs array)
  ipcMain.handle('cron:create', async (_event, job: unknown) => {
    try {
      if (typeof job !== 'object' || job === null) return { success: false, error: 'Expected object' };
      const cronPath = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json');
      let jobs: unknown[] = [];
      try {
        const raw = await fs.promises.readFile(cronPath, 'utf-8');
        jobs = JSON.parse(raw);
      } catch { /* file doesn't exist yet */ }
      if (!Array.isArray(jobs)) jobs = [];
      (jobs as unknown[]).push(job);
      await fs.promises.mkdir(path.dirname(cronPath), { recursive: true });
      await fs.promises.writeFile(cronPath, JSON.stringify(jobs, null, 2), 'utf-8');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  // Updates an existing cron job by id
  ipcMain.handle('cron:update', async (_event, id: unknown, updates: unknown) => {
    try {
      const safeId = isSafeString(id, 64);
      if (typeof updates !== 'object' || updates === null) return { success: false, error: 'Expected object' };
      const cronPath = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json');
      const raw = await fs.promises.readFile(cronPath, 'utf-8');
      const jobs: unknown[] = JSON.parse(raw);
      const idx = (jobs as { id?: string }[]).findIndex(j => j?.id === safeId);
      if (idx === -1) return { success: false, error: `Job '${safeId}' not found` };
      jobs[idx] = { ...(jobs[idx] as object), ...(updates as object) };
      await fs.promises.writeFile(cronPath, JSON.stringify(jobs, null, 2), 'utf-8');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  // Deletes a cron job by id
  ipcMain.handle('cron:delete', async (_event, id: unknown) => {
    try {
      const safeId = isSafeString(id, 64);
      const cronPath = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json');
      const raw = await fs.promises.readFile(cronPath, 'utf-8');
      const jobs: unknown[] = JSON.parse(raw);
      const filtered = (jobs as { id?: string }[]).filter(j => j?.id !== safeId);
      if (filtered.length === jobs.length) return { success: false, error: `Job '${safeId}' not found` };
      await fs.promises.writeFile(cronPath, JSON.stringify(filtered, null, 2), 'utf-8');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  // Toggles enabled state of a cron job by id
  ipcMain.handle('cron:toggle', async (_event, id: unknown, enabled: unknown) => {
    try {
      const safeId = isSafeString(id, 64);
      if (typeof enabled !== 'boolean') return { success: false, error: 'Expected boolean' };
      const cronPath = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json');
      const raw = await fs.promises.readFile(cronPath, 'utf-8');
      const jobs: unknown[] = JSON.parse(raw);
      const idx = (jobs as { id?: string }[]).findIndex(j => j?.id === safeId);
      const job = (jobs as { id?: string; enabled?: boolean }[])[idx];
      if (!job) return { success: false, error: `Job '${safeId}' not found` };
      job.enabled = enabled;
      await fs.promises.writeFile(cronPath, JSON.stringify(jobs, null, 2), 'utf-8');
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('system:autostart-get', async () => {
    try {
      const loginItemSettings = app.getLoginItemSettings();
      return { success: true, data: { enabled: loginItemSettings.openAtLogin } };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  // ── Gateway WebSocket RPC ───────────────────────────────────────────────────

  // Connect WS channel (no-op if already connected) + start event forwarding
  ipcMain.handle('gateway:connect', async () => {
    try {
      // Register event handler to forward WS events to renderer
      onGatewayEvent((event) => {
        const mainWin = getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send('gateway:event', event);
        }
        const floatWin = getFloatWindow();
        if (floatWin && !floatWin.isDestroyed()) {
          floatWin.webContents.send('gateway:event', event);
        }
      });
      await connectGatewayWs();
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // List agents via WS RPC (CLI fallback)
  ipcMain.handle('gateway:agents', async () => {
    try {
      const data = await getGatewayAgents();
      return { success: true, data };
    } catch {
      // Fallback to CLI
      try {
        return await runCommand('agents list');
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  });

  // List sessions via WS RPC
  ipcMain.handle('gateway:sessions', async () => {
    try {
      const data = await getGatewaySessions();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Get chat history for a session via WS RPC
  ipcMain.handle('gateway:chat-history', async (_event, sessionKey: string, limit?: number) => {
    try {
      const data = await getChatHistory(sessionKey, limit);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Get gateway logs via WS RPC (CLI/file fallback)
  ipcMain.handle('gateway:logs:ws', async (_event, tail = 100) => {
    try {
      const data = await getGatewayLogsWs(tail);
      return { success: true, data };
    } catch {
      // Fallback: use existing file-based getGatewayLogs
      try {
        const lines = await getGatewayLogs();
        return { success: true, data: lines.slice(-tail) };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  });

  // Generic RPC call (for advanced usage)
  ipcMain.handle('gateway:rpc', async (_event, method: string, params?: Record<string, unknown>) => {
    try {
      const data = await gatewayRpcCall(method, params);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // Full gateway health via WS RPC (channels, agents, sessions) — gateway token auth
  ipcMain.handle('gateway:health-rpc', async () => {
    try {
      const data = await getGatewayHealthRpc();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('system:autostart-set', async (_event, enabled: unknown) => {
    try {
      if (typeof enabled !== 'boolean') return { success: false, error: 'Expected boolean' };
      app.setLoginItemSettings({ openAtLogin: enabled });
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  });

  log.info('IPC handlers ready');
}
