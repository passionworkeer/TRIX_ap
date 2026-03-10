/**
 * Local Command Service
 *
 * Handles local ClawPilot commands:
 * - clawpilot.config (read config)
 * - clawpilot.doctor (run diagnostics)
 * - clawpilot.logs (read logs)
 * - clawpilot.version (get version)
 * - clawpilot.update (update version)
 * - clawpilot.gateway.restart (restart Gateway)
 * - clawpilot.fix.tools (fix tools permissions)
 * - clawpilot.restore.config (restore config)
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Config paths
const CONFIG_DIR = process.env.CLAWPILOT_CONFIG_DIR || path.join(process.env.HOME || process.env.USERPROFILE, '.clawpilot');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const BACKUP_DIR = path.join(CONFIG_DIR, 'backups');

class LocalCommandService {
  constructor() {
    this.openclawPath = process.env.OPENCLAW_PATH || 'openclaw';
  }

  /**
   * Get clawpilot config
   */
  async config(args = []) {
    try {
      if (!fs.existsSync(CONFIG_FILE)) {
        return { config: {} };
      }

      const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

      // Hide sensitive data
      const sanitized = { ...configData };
      if (sanitized.providers) {
        for (const [key, provider] of Object.entries(sanitized.providers)) {
          if (provider.apiKey) {
            provider.apiKey = '***';
          }
        }
      }

      return { config: sanitized };
    } catch (error) {
      throw new Error(`Failed to read config: ${error.message}`);
    }
  }

  /**
   * Run doctor (diagnostics)
   */
  async doctor(args = []) {
    const results = {
      timestamp: new Date().toISOString(),
      checks: [],
    };

    // Check Node.js version
    try {
      const { stdout } = await execAsync('node --version');
      results.checks.push({
        name: 'node',
        status: 'ok',
        version: stdout.trim(),
      });
    } catch (error) {
      results.checks.push({
        name: 'node',
        status: 'error',
        error: 'Node.js not found',
      });
    }

    // Check OpenClaw CLI
    try {
      const { stdout } = await execAsync(`${this.openclawPath} --version`);
      results.checks.push({
        name: 'openclaw',
        status: 'ok',
        version: stdout.trim(),
      });
    } catch (error) {
      results.checks.push({
        name: 'openclaw',
        status: 'error',
        error: 'OpenClaw CLI not found',
      });
    }

    // Check config directory
    if (fs.existsSync(CONFIG_DIR)) {
      results.checks.push({
        name: 'config_dir',
        status: 'ok',
        path: CONFIG_DIR,
      });
    } else {
      results.checks.push({
        name: 'config_dir',
        status: 'error',
        error: 'Config directory not found',
      });
    }

    // Check Gateway
    try {
      const { stdout } = await execAsync(`${this.openclawPath} gateway status`);
      results.checks.push({
        name: 'gateway',
        status: 'ok',
        output: stdout.trim(),
      });
    } catch (error) {
      results.checks.push({
        name: 'gateway',
        status: 'error',
        error: error.message,
      });
    }

    // Check tools directory
    const toolsDir = path.join(CONFIG_DIR, 'tools');
    if (fs.existsSync(toolsDir)) {
      const tools = fs.readdirSync(toolsDir);
      results.checks.push({
        name: 'tools',
        status: 'ok',
        count: tools.length,
      });
    } else {
      results.checks.push({
        name: 'tools',
        status: 'warning',
        message: 'Tools directory not found',
      });
    }

    return results;
  }

  /**
   * Repair issues found by doctor
   */
  async doctorRepair(args = []) {
    const results = {
      repairs: [],
    };

    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      results.repairs.push({
        action: 'create_config_dir',
        status: 'ok',
      });
    }

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      results.repairs.push({
        action: 'create_backup_dir',
        status: 'ok',
      });
    }

    // Create default config if not exists
    if (!fs.existsSync(CONFIG_FILE)) {
      const defaultConfig = {
        providers: {},
        gateway: {
          port: 8080,
          auth: 'device',
        },
      };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
      results.repairs.push({
        action: 'create_default_config',
        status: 'ok',
      });
    }

    return results;
  }

  /**
   * Read logs
   */
  async logs(args = []) {
    const limit = parseInt(args[0]) || 100;
    const logDir = path.join(CONFIG_DIR, 'logs');

    let logFiles = [];
    if (fs.existsSync(logDir)) {
      logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
    }

    if (logFiles.length === 0) {
      return { logs: 'No log files found' };
    }

    // Get most recent log file
    const latestLog = logFiles
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(logDir, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime)[0];

    const logPath = path.join(logDir, latestLog.name);
    let logContent = fs.readFileSync(logPath, 'utf8');

    // Get last N lines
    const lines = logContent.split('\n');
    const lastLines = lines.slice(-limit);

    return { logs: lastLines.join('\n'), file: latestLog.name };
  }

  /**
   * Get version
   */
  async version(args = []) {
    try {
      const { stdout } = await execAsync(`${this.openclawPath} --version`);
      return { version: stdout.trim() };
    } catch (error) {
      throw new Error('Failed to get version');
    }
  }

  /**
   * Update OpenClaw
   */
  async update(args = []) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.openclawPath, ['update', ...args], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ output: output.trim() });
        } else {
          reject(new Error(errorOutput || `Update failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Restart Gateway
   */
  async gatewayRestart(args = []) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.openclawPath, ['gateway', 'restart'], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ output: output.trim() });
        } else {
          reject(new Error(errorOutput || `Gateway restart failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Fix tools permissions
   */
  async fixTools(args = []) {
    const toolsDir = path.join(CONFIG_DIR, 'tools');

    if (!fs.existsSync(toolsDir)) {
      return { fixed: [], message: 'Tools directory not found' };
    }

    const files = fs.readdirSync(toolsDir);
    const fixed = [];

    for (const file of files) {
      const filePath = path.join(toolsDir, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile() && !file.endsWith('.json')) {
        try {
          fs.chmodSync(filePath, 0o755);
          fixed.push(file);
        } catch (error) {
          console.error(`Failed to fix ${file}:`, error);
        }
      }
    }

    return { fixed, count: fixed.length };
  }

  /**
   * Restore config from backup
   */
  async restoreConfig(args = []) {
    const backupName = args[0];

    if (!backupName) {
      // List available backups
      if (!fs.existsSync(BACKUP_DIR)) {
        return { backups: [], message: 'No backups found' };
      }

      const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
      return { backups, message: 'Please specify backup name' };
    }

    const backupPath = path.join(BACKUP_DIR, backupName);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup ${backupName} not found`);
    }

    // Create current config backup first
    if (fs.existsSync(CONFIG_FILE)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const currentBackup = path.join(BACKUP_DIR, `config-pre-restore-${timestamp}.json`);
      fs.copyFileSync(CONFIG_FILE, currentBackup);
    }

    // Restore from backup
    fs.copyFileSync(backupPath, CONFIG_FILE);

    return { restored: backupName };
  }

  /**
   * Backup config
   */
  async backupConfig(args = []) {
    if (!fs.existsSync(CONFIG_FILE)) {
      throw new Error('No config file to backup');
    }

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = args[0] || `config-${timestamp}.json`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    fs.copyFileSync(CONFIG_FILE, backupPath);

    return { backup: backupName };
  }

  /**
   * Execute local command
   */
  async execute(command, args = []) {
    const [module, ...cmdParts] = command.split('.');
    const cmd = cmdParts.join('.');

    switch (command) {
      case 'clawpilot.config':
        return await this.config(args);

      case 'clawpilot.doctor':
        return await this.doctor(args);

      case 'clawpilot.doctor_repair':
      case 'clawpilot.fix':
        return await this.doctorRepair(args);

      case 'clawpilot.logs':
        return await this.logs(args);

      case 'clawpilot.version':
        return await this.version(args);

      case 'clawpilot.update':
        return await this.update(args);

      case 'clawpilot.gateway.restart':
        return await this.gatewayRestart(args);

      case 'clawpilot.fix.tools':
        return await this.fixTools(args);

      case 'clawpilot.restore.config':
        return await this.restoreConfig(args);

      case 'clawpilot.backup.config':
        return await this.backupConfig(args);

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }
}

module.exports = new LocalCommandService();
