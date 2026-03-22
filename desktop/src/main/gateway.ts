import { spawn, exec, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import http from 'http';
import log from 'electron-log/main';
import { app } from 'electron';
import fs from 'fs';
import { getOpenClawPath } from './openclaw';

const execAsync = promisify(exec);

let gatewayProcess: ChildProcess | null = null;
const GATEWAY_PORT = 18789;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}`;

// In-memory ring buffer for gateway stdout/stderr (max 500 lines)
const LOG_BUFFER: string[] = [];
const MAX_LOG_LINES = 500;

function pushLog(line: string): void {
  LOG_BUFFER.push(line);
  if (LOG_BUFFER.length > MAX_LOG_LINES) {
    LOG_BUFFER.shift();
  }
}

export function getGatewayLogs(opts?: { lines?: number }): string[] {
  const count = opts?.lines ?? 100;
  return LOG_BUFFER.slice(-count);
}

function isPortInUse(_port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${GATEWAY_URL}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForGateway(maxWaitMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const inUse = await isPortInUse(GATEWAY_PORT);
      if (inUse) {
        log.info('Gateway is ready');
        return;
      }
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Gateway did not start in time');
}

export async function startGateway(): Promise<void> {
  if (gatewayProcess) {
    log.info('Gateway already running');
    return;
  }

  // Check if port already in use
  const inUse = await isPortInUse(GATEWAY_PORT);
  if (inUse) {
    log.info('Gateway already running on port', GATEWAY_PORT);
    return;
  }

  log.info('Starting gateway on port', GATEWAY_PORT);

  const openclawBin = getOpenClawPath();
  const localBinExists = fs.existsSync(openclawBin);

  const userDataDir = app.getPath('userData');

  const cmd = localBinExists
    ? openclawBin
    : (process.platform === 'win32' ? 'openclaw' : 'openclaw');

  const args = ['gateway', '--port', String(GATEWAY_PORT)];

  // shell: true needed for .cmd/.bat files on Windows
  gatewayProcess = spawn(cmd, args, {
    shell: true,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      TRIX_GATEWAY_PORT: String(GATEWAY_PORT),
      // Use userData dir for state — works in both dev and prod regardless of cwd
      TRIX_NATIVE_STORAGE_DIR: userDataDir,
    },
  });

  gatewayProcess.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      log.info('[gateway]', msg);
      pushLog(msg);
    }
  });

  gatewayProcess.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      log.warn('[gateway:err]', msg);
      pushLog(`[ERR] ${msg}`);
    }
  });

  gatewayProcess.on('close', (code) => {
    log.info('Gateway process exited with code:', code);
    gatewayProcess = null;
  });

  gatewayProcess.on('error', (err) => {
    log.error('Gateway process error:', err);
    gatewayProcess = null;
  });

  // Wait for gateway to be ready
  try {
    await waitForGateway();
    log.info('Gateway started successfully');
  } catch (err) {
    log.error('Gateway failed to start:', err);
    throw err;
  }
}

export async function stopGateway(): Promise<void> {
  if (gatewayProcess) {
    log.info('Stopping gateway...');
    gatewayProcess.kill('SIGTERM');
    gatewayProcess = null;
  }

  // Also try to kill by port on Windows
  if (process.platform === 'win32') {
    try {
      await execAsync(`netstat -ano | findstr :${GATEWAY_PORT}`, { shell: 'cmd.exe' });
      // Try to kill the process by port
      const { stdout: _stdout } = await execAsync(
        `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${GATEWAY_PORT}') do taskkill /F /PID %a`,
        { shell: 'cmd.exe' }
      );
    } catch {
      // Process not found or already killed
    }
  }
}

export async function getGatewayStatus(): Promise<{
  running: boolean;
  port?: number;
  pid?: number;
  url?: string;
  error?: string;
}> {
  const inUse = await isPortInUse(GATEWAY_PORT);
  if (inUse) {
    return {
      running: true,
      port: GATEWAY_PORT,
      pid: gatewayProcess?.pid,
      url: GATEWAY_URL,
    };
  }
  return { running: false, port: GATEWAY_PORT };
}

export async function restartGateway(): Promise<void> {
  log.info('Restarting gateway...');
  await stopGateway();
  await new Promise((r) => setTimeout(r, 2000));
  await startGateway();
}
