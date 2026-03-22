import { ipcMain } from 'electron';
import log from 'electron-log/main';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import Store from 'electron-store';
import {
  showMainWindow,
  hideMainWindow,
  minimizeToTray,
  pushBotState,
} from './window-state';
import { checkOpenClaw, installOpenClaw, runCommand } from './openclaw';
import { getGatewayStatus, restartGateway } from './gateway';

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

  // === BotState Push (from main window to float window) ===
  ipcMain.handle('bot-state:push', (_event, state) => {
    const validated = isValidBotState(state);
    pushBotState(validated);
    return true;
  });

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

  ipcMain.handle('auth:sign-up', async (_event, email: string, password: string) => {
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
        body: JSON.stringify({ email, password }),
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

  /**
   * Get the TRIX Native Server base URL + device token from OpenClaw config.
   */
  function getTrixNativeServerConfig(): { serverUrl: string; deviceToken: string } | null {
    const cfg = getNativeChannelConfig();
    if (!cfg) return null;
    return { serverUrl: cfg.serverUrl, deviceToken: cfg.adminToken };
  }

  /** List all conversations for the current device */
  ipcMain.handle('trixnative:conversations', async () => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) return { success: false, error: 'TRIX Native channel not configured' };

      const res = await httpRequest({
        method: 'GET',
        url: `${config.serverUrl}/api/conversations`,
        headers: {
          'x-trix-client-token': config.deviceToken,
          Accept: 'application/json',
        },
      });

      if (res.statusCode !== 200) {
        return { success: false, error: `Server returned ${res.statusCode}` };
      }

      const data = JSON.parse(res.body);
      return { success: true, data: Array.isArray(data) ? data : [] };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Fetch messages for a specific conversation */
  ipcMain.handle('trixnative:messages', async (_event, conversationId: string) => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) return { success: false, error: 'TRIX Native channel not configured' };

      const res = await httpRequest({
        method: 'GET',
        url: `${config.serverUrl}/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        headers: {
          'x-trix-client-token': config.deviceToken,
          Accept: 'application/json',
        },
      });

      if (res.statusCode !== 200) {
        return { success: false, error: `Server returned ${res.statusCode}` };
      }

      const data = JSON.parse(res.body);
      return { success: true, data: Array.isArray(data) ? data : [] };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  /** Send a message to a conversation */
  ipcMain.handle('trixnative:send-message', async (_event, conversationId: string, content: string) => {
    try {
      const config = getTrixNativeServerConfig();
      if (!config) return { success: false, error: 'TRIX Native channel not configured' };

      const res = await httpRequest({
        method: 'POST',
        url: `${config.serverUrl}/api/messages`,
        headers: {
          'Content-Type': 'application/json',
          'x-trix-client-token': config.deviceToken,
          Accept: 'application/json',
        },
        body: JSON.stringify({ conversationId, content }),
      });

      if (res.statusCode !== 200 && res.statusCode !== 201) {
        return { success: false, error: `Server returned ${res.statusCode}` };
      }

      const data = JSON.parse(res.body);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // === Native Channel Pairing (HTTP API) ===

  /**
   * Read TRIX Native Channel credentials from the OpenClaw config file.
   * The config is at ~/.openclaw/openclaw.json and contains:
   * { channels: { "trix-native": { accounts: { default: { serverUrl, adminToken } } } } }
   */
  function getNativeChannelConfig(): { serverUrl: string; adminToken: string } | null {
    try {
      const openclawConfigPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
      if (!fs.existsSync(openclawConfigPath)) {
        log.warn('OpenClaw config not found:', openclawConfigPath);
        return null;
      }
      const config = JSON.parse(fs.readFileSync(openclawConfigPath, 'utf-8'));
      const trixChannel = config?.channels?.['trix-native'];
      if (!trixChannel) {
        log.warn('trix-native channel not configured in OpenClaw config');
        return null;
      }
      const account = trixChannel.accounts?.default;
      if (!account?.serverUrl || !account?.adminToken) {
        log.warn('trix-native channel missing serverUrl or adminToken');
        return null;
      }
      return { serverUrl: account.serverUrl, adminToken: account.adminToken };
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

      const res = await httpRequest({
        method: 'POST',
        url: `${config.serverUrl}/api/pairings`,
        headers: {
          'Content-Type': 'application/json',
          'x-trix-admin-token': config.adminToken,
        },
        body: JSON.stringify({ label: label ?? 'Desktop Float Window' }),
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

      const res = await httpRequest({
        method: 'GET',
        url: `${config.serverUrl}/api/pairings/${encodeURIComponent(code)}`,
        headers: {
          'x-trix-admin-token': config.adminToken,
        },
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

  // === Gateway ===
  ipcMain.handle('gateway:status', async () => {
    try {
      return await getGatewayStatus();
    } catch (err) {
      log.error('gateway:status error:', err);
      return { running: false, error: String(err) };
    }
  });

  ipcMain.handle('gateway:restart', async () => {
    try {
      await restartGateway();
      return { success: true };
    } catch (err) {
      log.error('gateway:restart error:', err);
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

  log.info('IPC handlers ready');
}
