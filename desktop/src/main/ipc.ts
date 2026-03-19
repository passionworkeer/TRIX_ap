import { ipcMain, app } from 'electron';
import log from 'electron-log/main';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
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
];

function isAllowedCommand(fullCmd: string): boolean {
  const parts = fullCmd.trim().split(/\s+/);
  const primary = parts[0]?.toLowerCase() ?? '';
  return ALLOWED_COMMANDS.some(
    (ac) => ac.cmd === primary && (ac.args === undefined || parts.slice(1).join(' ') === ac.args.join(' '))
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

  // === App Info ===
  ipcMain.handle('app:info', () => {
    return {
      version: app.getVersion(),
      name: app.getName(),
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
      platform: process.platform,
      userData: app.getPath('userData'),
      isPackaged: app.isPackaged,
    };
  });

  log.info('IPC handlers ready');
}
