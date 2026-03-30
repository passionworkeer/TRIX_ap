import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log/main';
import fs from 'fs';

const execAsync = promisify(exec);

// Local install path (no admin required)
const LOCAL_OPENCLAW_PATH = () =>
  path.join(app.getPath('userData'), 'openclaw');

function getOpenClawBin(): string {
  if (process.platform === 'win32') {
    return path.join(LOCAL_OPENCLAW_PATH(), 'openclaw.cmd');
  }
  return path.join(LOCAL_OPENCLAW_PATH(), 'bin', 'openclaw');
}

// Try to find openclaw in PATH or local install
async function findOpenClaw(): Promise<{ path: string; version: string } | null> {
  // Try local install first
  const localBin = getOpenClawBin();
  if (fs.existsSync(localBin)) {
    try {
      const { stdout } = await execAsync(`"${localBin}" --version`, { timeout: 10000 });
      const version = stdout.trim();
      return { path: localBin, version };
    } catch {
      // fall through
    }
  }

  // Try PATH
  const PATH_cmd = process.platform === 'win32' ? 'where openclaw' : 'which openclaw';
  try {
    const { stdout } = await execAsync(PATH_cmd, { timeout: 5000 });
    const cmdPath = stdout.trim().split('\n')[0]?.trim() ?? '';
    if (cmdPath) {
      const { stdout: ver } = await execAsync(`"${cmdPath}" --version`, { timeout: 10000 });
      return { path: cmdPath, version: ver.trim() };
    }
  } catch {
    // not found in PATH
  }

  return null;
}

export async function checkOpenClaw(): Promise<{
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
}> {
  try {
    const found = await findOpenClaw();
    if (found) {
      log.info('OpenClaw found:', found);
      return { installed: true, version: found.version, path: found.path };
    }
    return { installed: false };
  } catch (err) {
    log.error('checkOpenClaw error:', err);
    return { installed: false, error: String(err) };
  }
}

export async function installOpenClaw(
  onProgress: (msg: string) => void
): Promise<void> {
  const installPath = LOCAL_OPENCLAW_PATH();
  log.info('Installing OpenClaw to:', installPath);

  onProgress('正在检查环境...');

  // Check which package manager is available
  let packageManager = 'pnpm';
  try {
    await execAsync('pnpm --version', { timeout: 5000 });
    packageManager = 'pnpm';
    onProgress('使用 pnpm 安装...');
  } catch {
    try {
      await execAsync('npm --version', { timeout: 5000 });
      packageManager = 'npm';
      onProgress('pnpm 未找到，改用 npm 安装...');
    } catch {
      throw new Error('未找到 pnpm 或 npm，请先安装 Node.js (https://nodejs.org)');
    }
  }

  onProgress('正在准备安装目录...');

  // Ensure install directory exists
  if (!fs.existsSync(installPath)) {
    fs.mkdirSync(installPath, { recursive: true });
  }

  const args = packageManager === 'pnpm'
    ? ['add', '-g', 'openclaw']
    : ['install', '-g', 'openclaw'];

  onProgress(`正在安装 OpenClaw (${packageManager})...`);

  return new Promise((resolve, reject) => {
    const proc = spawn(packageManager, args, {
      shell: true,
      env: { ...process.env },
    });

    let stderr = '';
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.stdout?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) onProgress(msg);
    });

    proc.on('close', (_code) => {
      if (_code === 0) {
        onProgress('安装完成!');
        log.info('OpenClaw installed to', installPath);
        resolve();
      } else {
        const err = `安装失败，退出码 ${_code}: ${stderr}`;
        log.error(err);
        reject(new Error(err));
      }
    });

    proc.on('error', (err) => {
      log.error('Install spawn error:', err);
      reject(err);
    });
  });
}

export async function runCommand(cmd: string): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
}> {
  // Find openclaw binary
  let openclawBin = getOpenClawBin();
  if (!fs.existsSync(openclawBin)) {
    openclawBin = process.platform === 'win32' ? 'openclaw.cmd' : 'openclaw';
  }

  const parts = cmd.trim().split(/\s+/);
  const subcommand = parts[0]?.toLowerCase() ?? '';
  const subArgs = parts.slice(1);

  try {
    const { spawn } = await import('child_process');
    // Use a short timeout since the trix-native plugin hangs when the remote
    // server (TRIX_SERVER_HOST:8788) is unreachable. 10s is enough for local
    // commands and avoids blocking the renderer for a full minute.
    const COMMAND_TIMEOUT = 10_000;

    const proc = spawn(openclawBin, [subcommand, ...subArgs], {
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    const exitCode = await new Promise<number>((resolve) => {
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill();
        resolve(124);
      }, COMMAND_TIMEOUT);

      proc.on('close', (_code) => {
        clearTimeout(timer);
        resolve(timedOut ? 124 : (_code ?? 0));
      });
      proc.on('error', () => {
        clearTimeout(timer);
        resolve(1);
      });
    });

    if (timedOut) {
      return {
        success: false,
        stdout: stdout.trim(),
        stderr: `命令超时 (${COMMAND_TIMEOUT / 1000}s) — trix-native 插件可能无法连接到远程服务器`,
      };
    }

    return { success: exitCode === 0, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err: unknown) {
    return {
      success: false,
      stdout: '',
      stderr: String(err),
    };
  }
}

// Legacy — kept for internal use only, NOT exposed to renderer
export async function runOpenClawCommand(cmd: string): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
}> {
  return runCommand(cmd);
}

export function getOpenClawPath(): string {
  return getOpenClawBin();
}

// ── Skill Registry (via openclaw skills list --json) ─────────────────────────

export interface SkillInfo {
  name: string;
  description: string;
  source: string;
  bundled: boolean;
  installed: boolean;   // true if non-bundled (user-installed)
  missing: boolean;     // true if ready deps are missing
}

function parseSkillsJson(raw: string): SkillInfo[] {
  // Strip ANSI color codes
  const clean = raw.replace(/\x1b\[[0-9;]*m/g, '');
  const start = clean.indexOf('{"workspaceDir"');
  if (start === -1) return [];
  const jsonEnd = clean.lastIndexOf('}');
  if (jsonEnd <= start) return [];
  interface RawSkill {
    name: string; description?: string; source?: string;
    bundled?: boolean;
    missing?: { bins?: unknown[]; anyBins?: unknown[]; env?: unknown[]; config?: unknown[]; os?: unknown[] };
  }
  try {
    const j = JSON.parse(clean.substring(start, jsonEnd + 1));
    const skills: RawSkill[] = j.skills ?? [];
    return skills.map(s => {
      const m = s.missing ?? {};
      const missing = !!(m.bins?.length || m.anyBins?.length || m.env?.length || m.config?.length || m.os?.length);
      const bundled = s.bundled === true || s.source === 'openclaw-bundled';
      const installed = !!(!bundled && (s.source === 'openclaw-managed' || s.source === 'openclaw-workspace' || s.source === 'agents-skills-personal'));
      return {
        name: s.name,
        description: (s.description ?? '').split('\n')[0] ?? '',
        source: s.source ?? 'unknown',
        bundled,
        installed,
        missing,
      };
    });
  } catch {
    return [];
  }
}

export async function skillsList(): Promise<{ success: boolean; data: SkillInfo[]; error?: string }> {
  try {
    const { stdout } = await execAsync('openclaw skills list --json', { timeout: 15_000 });
    const skills = parseSkillsJson(stdout);
    return { success: true, data: skills };
  } catch (err) {
    log.warn('skillsList error:', err);
    return { success: false, data: [], error: String(err) };
  }
}

// ── ClawHub registry search/explore ──────────────────────────────────────────

export interface ClawHubSkill {
  slug: string;
  name: string;
  description?: string;
  score?: number;
}

function parseClawHubSearch(stdout: string): ClawHubSkill[] {
  // Format: "slug  Name  (score)" per line
  const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
  return lines
    .filter(l => !l.startsWith('-') && !l.startsWith('No skills'))
    .map(l => {
      // "slug  Name  (score)" or just "slug  Name"
      const scoreMatch = l.match(/^(.+?)\s{2,}(.+?)\s+\((\d+\.\d+)\)\s*$/);
      if (scoreMatch && scoreMatch[1] && scoreMatch[2] && scoreMatch[3]) {
        return { slug: scoreMatch[1].trim(), name: scoreMatch[2].trim(), score: parseFloat(scoreMatch[3]) };
      }
      const parts = l.split(/\s{2,}/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return { slug: parts[0].trim(), name: parts[1].trim() };
      }
      return null;
    })
    .filter((s): s is ClawHubSkill => s !== null);
}

function parseClawHubExplore(stdout: string): ClawHubSkill[] {
  // Format: similar to search, lines with slug and name
  const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
  return lines
    .filter(l => !l.startsWith('-') && !l.startsWith('No skills') && !l.startsWith('Fetching'))
    .map(l => {
      const parts = l.split(/\s{2,}/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return { slug: parts[0].trim(), name: parts[1].trim() };
      }
      return null;
    })
    .filter((s): s is ClawHubSkill => s !== null);
}

function execClawhub(args: string[]): Promise<{ stdout: string; stderr: string; timedOut?: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['clawhub@latest', ...args], {
      shell: true,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ stdout: stdout.trim(), stderr: '命令超时 (120s)', timedOut: true });
    }, 120_000);
    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (_code) => {
      clearTimeout(timer);
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: String(err) });
    });
  });
}

export async function clawhubSearch(query: string): Promise<{ success: boolean; data: ClawHubSkill[]; error?: string }> {
  try {
    const { stdout, stderr } = await execClawhub(['search', query, '--limit', '20']);
    if (stderr.includes('Rate limit')) {
      return { success: false, data: [], error: '访问频率限制，请稍后再试' };
    }
    return { success: true, data: parseClawHubSearch(stdout) };
  } catch (err) {
    log.warn('clawhubSearch error:', err);
    return { success: false, data: [], error: String(err) };
  }
}

export async function clawhubExplore(): Promise<{ success: boolean; data: ClawHubSkill[]; error?: string }> {
  try {
    const { stdout, stderr } = await execClawhub(['explore']);
    if (stderr.includes('Rate limit')) {
      return { success: false, data: [], error: '访问频率限制，请稍后再试' };
    }
    return { success: true, data: parseClawHubExplore(stdout) };
  } catch (err) {
    log.warn('clawhubExplore error:', err);
    return { success: false, data: [], error: String(err) };
  }
}

export async function clawhubInstall(slug: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['clawhub@latest', 'install', slug], {
      shell: true,
      env: { ...process.env },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code: number) => {
      resolve({ success: code === 0, stdout: stdout.trim(), stderr: stderr.trim() });
    });
    proc.on('error', (err: Error) => {
      resolve({ success: false, stdout: '', stderr: String(err) });
    });
  });
}
