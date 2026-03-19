import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log/main';
import fs from 'fs';
import os from 'os';

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
    const cmdPath = stdout.trim().split('\n')[0].trim();
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

    proc.on('close', (code) => {
      if (code === 0) {
        onProgress('安装完成!');
        log.info('OpenClaw installed to', installPath);
        resolve();
      } else {
        const err = `安装失败，退出码 ${code}: ${stderr}`;
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
    // Use spawn with argv array — no shell interpolation
    const { spawn } = await import('child_process');
    const proc = spawn(openclawBin, [subcommand, ...subArgs], {
      timeout: 60000,
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    const exitCode = await new Promise<number>((resolve) => {
      proc.on('close', (code) => resolve(code ?? 0));
      proc.on('error', () => resolve(1));
      // Timeout
      setTimeout(() => {
        proc.kill();
        resolve(124);
      }, 60000);
    });

    if (exitCode === 0) {
      return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    }
    return { success: false, stdout: stdout.trim(), stderr: stderr.trim() };
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
