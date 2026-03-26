import { spawn, exec, execFile, type ChildProcess } from 'child_process';
import { promisify } from 'util';
import http from 'http';
import log from 'electron-log/main';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Store from 'electron-store';
import { getOpenClawPath } from './openclaw';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// ─── Constants ────────────────────────────────────────────────────────────────

const GATEWAY_PORT = 18789;
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}`;
const HEALTH_CACHE_TTL_MS = 15_000; // 15-second TTL cache
const MAX_LOG_LINES = 500;
const MAX_ANALYSIS_LINES = 200; // max lines to analyze per log file

// ─── Types ─────────────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface GatewayHealth {
  status: HealthStatus;
  layers: {
    port: { ok: boolean; pid?: number };
    http: { ok: boolean; statusCode?: number; latencyMs?: number };
    cli: { ok: boolean; version?: string; warning?: string };
  };
  timestamp: string;
  issues: HealthIssue[];
}

export interface HealthIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  layer?: 'port' | 'http' | 'cli';
}

export interface LogIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  file?: string;
  line?: string;
  timestamp?: string;
}

export interface Diagnosis {
  type: string;
  rootCause: string;
  confidence: number;
  suggestedActions: string[];
  issues: HealthIssue[];
}

// ─── State ─────────────────────────────────────────────────────────────────

let gatewayProcess: ChildProcess | null = null;

// In-memory ring buffer for gateway stdout/stderr
const LOG_BUFFER: string[] = [];

function pushLog(line: string): void {
  LOG_BUFFER.push(line);
  if (LOG_BUFFER.length > MAX_LOG_LINES) {
    LOG_BUFFER.shift();
  }
}

// TTL health cache
const healthCache: Map<string, { data: unknown; timestamp: number }> = new Map();

// Knowledge base (electron-store backed)
interface KbEntry {
  attempts: { solution: string; success: boolean; duration: number; ts: string }[];
  successfulSolutions: Record<string, { count: number; lastUsed: string; avgDuration: number }>;
  failedSolutions: Record<string, { count: number; lastFailed: string }>;
  bestSolution?: string;
  totalAttempts: number;
  successfulAttempts: number;
}
interface KnowledgeBase {
  version: string;
  lastUpdated: string;
  fixes: Record<string, KbEntry>;
}

const kbStore = new Store<KnowledgeBase>({
  name: 'gateway-fix-kb',
  defaults: { version: '1.0', lastUpdated: new Date().toISOString(), fixes: {} },
});

// Error patterns — mirrors control-center patterns
const ERROR_PATTERNS: Array<{ name: string; pattern: RegExp; severity: 'critical' | 'warning' | 'info' }> = [
  { name: 'WINDOWS_PORT_ISSUE', pattern: /EADDRINUSE.*18789|port.*18789.*in use/i, severity: 'critical' },
  { name: 'PORT_CONFLICT', pattern: /address already in use|port.*occupied/i, severity: 'critical' },
  { name: 'WINDOWS_PERMISSION', pattern: /requires elevation|run as administrator|EACCES/i, severity: 'critical' },
  { name: 'AUTH_FAILURE', pattern: /401|403|unauthorized|forbidden|authentication.*failed/i, severity: 'warning' },
  { name: 'RATE_LIMIT', pattern: /429|too many requests|rate limit/i, severity: 'warning' },
  { name: 'TIMEOUT', pattern: /timeout|etimedout|connection.*timed.*out|ECONNRESET/i, severity: 'warning' },
  { name: 'CLI_ERROR', pattern: /openclaw.*error|command.*failed|spawn.*ENOENT/i, severity: 'warning' },
  { name: 'GATEWAY_CRASH', pattern: /gateway.*crash|process.*exit|gateway.*stopped/i, severity: 'critical' },
  { name: 'CONFIG_ERROR', pattern: /config.*invalid|cannot.*read|ENOENT.*json/i, severity: 'warning' },
  { name: 'INFO', pattern: /warn|error|failed|exception|critical/i, severity: 'info' },
];

// Problem pattern library for diagnosis
const PROBLEM_PATTERNS: Record<string, {
  confidence: number;
  rootCause: string;
  actions: string[];
  patterns: RegExp[];
}> = {
  PROCESS_NOT_RUNNING: {
    confidence: 0.95,
    rootCause: 'OpenClaw Gateway 进程未运行',
    actions: ['restart_gateway', 'check_openclaw_install'],
    patterns: [/connection refused|port.*not listening/i],
  },
  PORT_CONFLICT: {
    confidence: 0.95,
    rootCause: '端口 18789 被其他进程占用',
    actions: ['kill_port_process', 'restart_gateway'],
    patterns: [/address already in use|port.*18789.*in use|EADDRINUSE.*18789/i],
  },
  CLI_NOT_INSTALLED: {
    confidence: 0.9,
    rootCause: 'OpenClaw CLI 未安装或不在 PATH 中',
    actions: ['install_openclaw'],
    patterns: [/spawn.*ENOENT|openclaw.*not found|command not found/i],
  },
  WINDOWS_PERMISSION: {
    confidence: 0.95,
    rootCause: 'Windows 权限不足（需要管理员权限）',
    actions: ['check_admin_rights'],
    patterns: [/requires elevation|run as administrator|EACCES/i],
  },
  AUTH_FAILURE: {
    confidence: 0.85,
    rootCause: 'API 认证失败，Token 可能过期',
    actions: ['check_token', 'refresh_auth'],
    patterns: [/401|403|unauthorized|forbidden/i],
  },
  GATEWAY_UNSTABLE: {
    confidence: 0.8,
    rootCause: 'Gateway 进程不稳定，频繁重启',
    actions: ['analyze_logs', 'restart_gateway'],
    patterns: [/gateway.*crash|process.*exit|gateway.*stopped/i],
  },
};

// ─── Utility: TTL Cache ────────────────────────────────────────────────────

function getCached<T>(key: string): T | null {
  const cached = healthCache.get(key);
  if (cached && Date.now() - cached.timestamp < HEALTH_CACHE_TTL_MS) {
    return cached.data as T;
  }
  return null;
}

function setCache(key: string, data: unknown): void {
  healthCache.set(key, { data, timestamp: Date.now() });
}

function clearCache(key?: string): void {
  if (key) {
    healthCache.delete(key);
  } else {
    healthCache.clear();
  }
}

// ─── Layer 1: Port Check (netstat) ─────────────────────────────────────────

async function checkPortListening(targetPort: number): Promise<{ ok: boolean; pid?: number }> {
  try {
    const cmd = process.platform === 'win32'
      ? `netstat -ano | findstr :${targetPort}`
      : `lsof -i :${targetPort} -t 2>/dev/null || true`;
    const { stdout } = await execAsync(cmd, { shell: 'cmd.exe', timeout: 5000 });

    if (process.platform === 'win32') {
      const lines = stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const last = parts[parts.length - 1];
        // TCP listen lines contain LISTENING
        if (line.includes('LISTENING') || line.includes('ESTABLISHED')) {
          const pid = parseInt(last ?? '', 10);
          if (!isNaN(pid)) return { ok: true, pid };
        }
      }
    }
    const firstLine = stdout.trim().split('\n')[0] ?? '';
    const pid = parseInt(firstLine, 10);
    return { ok: !isNaN(pid), pid: isNaN(pid) ? undefined : pid };
  } catch {
    return { ok: false };
  }
}

// ─── Layer 2: HTTP Check ──────────────────────────────────────────────────

async function checkHttpHealth(): Promise<{ ok: boolean; statusCode?: number; latencyMs?: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = http.get(`${GATEWAY_URL}/health`, (res) => {
      resolve({ ok: res.statusCode === 200, statusCode: res.statusCode, latencyMs: Date.now() - start });
      res.resume();
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    req.setTimeout(5000);
  });
}

// ─── Layer 3: OpenClaw CLI Check ─────────────────────────────────────────

async function checkOpenClawCLI(): Promise<{ ok: boolean; version?: string; warning?: string }> {
  try {
    const { stdout } = await execFileAsync('openclaw', ['--version'], { timeout: 5000 });
    const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
    return { ok: true, version: versionMatch ? versionMatch[1] : stdout.trim() };
  } catch (err) {
    // Try health subcommand
    try {
      const { stdout, stderr } = await execFileAsync('openclaw', ['health', '--json'], { timeout: 8000 });
      const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
      return { ok: true, version: versionMatch ? versionMatch[1] : 'unknown', warning: stderr?.trim() || undefined };
    } catch {
      return { ok: false, warning: (err as Error).message };
    }
  }
}

// ─── Triple-layer Health Check ─────────────────────────────────────────────

export async function checkGatewayHealth(): Promise<GatewayHealth> {
  const cached = getCached<GatewayHealth>('gateway-health');
  if (cached) return cached;

  const issues: HealthIssue[] = [];

  // Layer 1: Port
  const portResult = await checkPortListening(GATEWAY_PORT);
  if (!portResult.ok) {
    issues.push({ type: 'PROCESS_NOT_RUNNING', severity: 'critical', message: `端口 ${GATEWAY_PORT} 未监听`, layer: 'port' });
  }

  // Layer 2: HTTP
  const httpResult = await checkHttpHealth();
  if (!httpResult.ok && portResult.ok) {
    issues.push({ type: 'HTTP_FAILED', severity: 'warning', message: `HTTP /health 响应异常 (${httpResult.statusCode ?? 'timeout'})`, layer: 'http' });
  }

  // Layer 3: CLI
  const cliResult = await checkOpenClawCLI();
  if (!cliResult.ok) {
    issues.push({ type: 'CLI_NOT_INSTALLED', severity: 'warning', message: `OpenClaw CLI 未安装或不在 PATH: ${cliResult.warning}`, layer: 'cli' });
  }

  // Determine overall status
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  let status: HealthStatus = 'healthy';
  if (criticalIssues.length > 0) {
    status = 'down';
  } else if (issues.length > 0) {
    status = 'degraded';
  }

  const result: GatewayHealth = {
    status,
    layers: {
      port: portResult,
      http: httpResult,
      cli: cliResult,
    },
    timestamp: new Date().toISOString(),
    issues,
  };

  setCache('gateway-health', result);
  return result;
}

// ─── Log Analyzer ──────────────────────────────────────────────────────────

function matchErrorPatterns(line: string): { name: string; severity: 'critical' | 'warning' | 'info' } | null {
  for (const ep of ERROR_PATTERNS) {
    if (ep.pattern.test(line)) {
      return { name: ep.name, severity: ep.severity };
    }
  }
  return null;
}

function analyzeLogLine(line: string, fileName?: string): LogIssue | null {
  const match = matchErrorPatterns(line);
  if (!match) return null;

  // Skip INFO-level noise
  if (match.name === 'INFO') return null;

  return {
    type: match.name,
    severity: match.severity,
    message: line.trim().substring(0, 200),
    file: fileName,
    line: line.trim().substring(0, 120),
  };
}

export function analyzeGatewayLogs(opts?: { lines?: number }): LogIssue[] {
  const count = opts?.lines ?? MAX_ANALYSIS_LINES;
  const issues: LogIssue[] = [];

  for (const line of LOG_BUFFER.slice(-count)) {
    const issue = analyzeLogLine(line, 'gateway-buffer');
    if (issue) issues.push(issue);
  }

  return issues;
}

export async function analyzeOpenClawLogs(userDataDir: string, opts?: { lines?: number }): Promise<LogIssue[]> {
  const issues: LogIssue[] = [];
  const count = opts?.lines ?? MAX_ANALYSIS_LINES;
  const logDir = path.join(userDataDir, 'logs');

  const logFiles = ['openclaw.log', 'gateway.log', 'error.log'];
  const openclawDir = path.join(userDataDir, 'openclaw');

  const dirsToCheck = [logDir, openclawDir, userDataDir];

  for (const dir of dirsToCheck) {
    if (!fs.existsSync(dir)) continue;

    for (const fileName of logFiles) {
      const filePath = path.join(dir, fileName);
      if (!fs.existsSync(filePath)) continue;

      try {
        const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        let processed = 0;
        const fileStat = fs.statSync(filePath);
        const isRecent = Date.now() - fileStat.mtimeMs < 24 * 60 * 60 * 1000; // last 24h

        if (!isRecent) {
          fileStream.close();
          continue;
        }

        for await (const line of rl) {
          const issue = analyzeLogLine(line, fileName);
          if (issue) issues.push(issue);
          processed++;
          if (processed >= count) break;
        }

        fileStream.close();
      } catch {
        // Ignore read errors
      }
    }
  }

  return issues;
}

// ─── Diagnostic Engine ─────────────────────────────────────────────────────

export async function diagnoseGateway(): Promise<Diagnosis> {
  const health = await checkGatewayHealth();
  const userDir = app.getPath('userData');
  const logIssues = await analyzeOpenClawLogs(userDir, { lines: 100 });
  const bufferIssues = analyzeGatewayLogs({ lines: 100 });

  const allIssues = [...health.issues, ...logIssues, ...bufferIssues];

  // Pattern-based diagnosis
  let bestMatch = PROBLEM_PATTERNS.PROCESS_NOT_RUNNING!;
  let highestConfidence = 0;

  for (const [, pattern] of Object.entries(PROBLEM_PATTERNS)) {
    const matched = allIssues.some(issue =>
      pattern.patterns.some(re => re.test(issue.message) || re.test(issue.type))
    );
    if (matched && pattern.confidence > highestConfidence) {
      highestConfidence = pattern.confidence;
      bestMatch = pattern as typeof bestMatch;
    }
  }

  // Check knowledge base for known solutions
  const kbIssueType = allIssues[0]?.type ?? 'UNKNOWN';
  const kbEntry = kbStore.get('fixes')[kbIssueType];
  let recommendedActions = bestMatch.actions;
  if (kbEntry?.bestSolution) {
    // Prepend learned best solution
    recommendedActions = [kbEntry.bestSolution, ...recommendedActions.filter(a => a !== kbEntry.bestSolution)];
  }

  return {
    type: allIssues[0]?.type ?? (health.status === 'healthy' ? 'HEALTHY' : 'UNKNOWN'),
    rootCause: health.status === 'healthy' ? 'Gateway 运行正常' : bestMatch.rootCause,
    confidence: highestConfidence,
    suggestedActions: recommendedActions,
    issues: allIssues,
  };
}

// ─── Knowledge Base ─────────────────────────────────────────────────────────

export function recordFixAttempt(issueType: string, solution: string, success: boolean, durationMs: number): void {
  const fixes = kbStore.get('fixes');
  if (!fixes[issueType]) {
    fixes[issueType] = {
      attempts: [],
      successfulSolutions: {},
      failedSolutions: {},
      totalAttempts: 0,
      successfulAttempts: 0,
    };
  }

  const entry = fixes[issueType];
  const now = new Date().toISOString();

  entry.attempts.push({ solution, success, duration: durationMs, ts: now });
  entry.totalAttempts++;

  if (success) {
    entry.successfulAttempts++;
    if (!entry.successfulSolutions[solution]) {
      entry.successfulSolutions[solution] = { count: 0, lastUsed: now, avgDuration: 0 };
    }
    const s = entry.successfulSolutions[solution];
    s.count++;
    s.lastUsed = now;
    s.avgDuration = (s.avgDuration * (s.count - 1) + durationMs) / s.count;

    if (!entry.bestSolution || s.count > (entry.successfulSolutions[entry.bestSolution]?.count ?? 0)) {
      entry.bestSolution = solution;
    }
  } else {
    if (!entry.failedSolutions[solution]) {
      entry.failedSolutions[solution] = { count: 0, lastFailed: now };
    }
    entry.failedSolutions[solution].count++;
    entry.failedSolutions[solution].lastFailed = now;
  }

  // Keep only last 50 attempts per issue
  if (entry.attempts.length > 50) {
    entry.attempts = entry.attempts.slice(-50);
  }

  kbStore.set('fixes', fixes);
  kbStore.set('lastUpdated', now);
}

export function getKbStats(): { totalIssues: number; totalAttempts: number; successRate: number } {
  const fixes = kbStore.get('fixes');
  const totalAttempts = Object.values(fixes).reduce((sum, e) => sum + e.totalAttempts, 0);
  const successfulAttempts = Object.values(fixes).reduce((sum, e) => sum + e.successfulAttempts, 0);
  return {
    totalIssues: Object.keys(fixes).length,
    totalAttempts,
    successRate: totalAttempts > 0 ? successfulAttempts / totalAttempts : 0,
  };
}

export function shouldAvoidSolution(issueType: string, solution: string): boolean {
  const entry = kbStore.get('fixes')[issueType];
  return (entry?.failedSolutions[solution]?.count ?? 0) >= 3;
}

// ─── Gateway Logs ──────────────────────────────────────────────────────────

export function getGatewayLogs(opts?: { lines?: number }): string[] {
  const count = opts?.lines ?? 100;
  return LOG_BUFFER.slice(-count);
}

// ─── Original Gateway API (backward compatible) ─────────────────────────────

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
      if (await isPortInUse(GATEWAY_PORT)) {
        log.info('Gateway is ready');
        return;
      }
    } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Gateway did not start in time');
}

export async function startGateway(): Promise<void> {
  if (gatewayProcess) {
    log.info('Gateway already running');
    return;
  }

  const inUse = await isPortInUse(GATEWAY_PORT);
  if (inUse) {
    log.info('Gateway already running on port', GATEWAY_PORT);
    return;
  }

  log.info('Starting gateway on port', GATEWAY_PORT);

  const openclawBin = getOpenClawPath();
  const localBinExists = fs.existsSync(openclawBin);
  const userDataDir = app.getPath('userData');
  const cmd = localBinExists ? openclawBin : (process.platform === 'win32' ? 'openclaw' : 'openclaw');
  const args = ['gateway', '--port', String(GATEWAY_PORT)];

  gatewayProcess = spawn(cmd, args, {
    shell: true,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      TRIX_GATEWAY_PORT: String(GATEWAY_PORT),
      TRIX_NATIVE_STORAGE_DIR: userDataDir,
    },
  });

  gatewayProcess.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      log.info('[gateway]', msg);
      pushLog(msg);
      clearCache('gateway-health');
    }
  });

  gatewayProcess.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) {
      log.warn('[gateway:err]', msg);
      pushLog(`[ERR] ${msg}`);
      clearCache('gateway-health');
    }
  });

  gatewayProcess.on('close', (code) => {
    log.info('Gateway process exited with code:', code);
    gatewayProcess = null;
    clearCache('gateway-health');
  });

  gatewayProcess.on('error', (err) => {
    log.error('Gateway process error:', err);
    gatewayProcess = null;
    clearCache('gateway-health');
  });

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

  if (process.platform === 'win32') {
    try {
      await execAsync(`netstat -ano | findstr :${GATEWAY_PORT}`, { shell: 'cmd.exe' });
      await execAsync(
        `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${GATEWAY_PORT}') do taskkill /F /PID %a`,
        { shell: 'cmd.exe' }
      );
    } catch { /* not found */ }
  }
  clearCache('gateway-health');
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
    return { running: true, port: GATEWAY_PORT, pid: gatewayProcess?.pid, url: GATEWAY_URL };
  }
  return { running: false, port: GATEWAY_PORT };
}

export async function restartGateway(): Promise<void> {
  log.info('Restarting gateway...');
  clearCache('gateway-health');
  await stopGateway();
  await new Promise((r) => setTimeout(r, 2000));
  await startGateway();
}
