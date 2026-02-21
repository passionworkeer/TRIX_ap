/**
 * TRIX Channel Manager Skill
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHANNEL_PATH = path.resolve(__dirname, '..', 'trix-channel');
let channelProcess = null;
let isRunning = false;

function ensureChannelPath() {
  if (!fs.existsSync(CHANNEL_PATH)) {
    throw new Error(`TRIX channel not found: ${CHANNEL_PATH}`);
  }

  const entry = path.join(CHANNEL_PATH, 'index.js');
  if (!fs.existsSync(entry)) {
    throw new Error(`TRIX channel entry missing: ${entry}`);
  }
}

async function startChannel() {
  if (isRunning) {
    return { success: true, message: 'TRIX Channel already running' };
  }

  ensureChannelPath();

  return new Promise((resolve, reject) => {
    channelProcess = spawn('node', ['index.js'], {
      cwd: CHANNEL_PATH,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    const timeout = setTimeout(() => {
      if (!isRunning && channelProcess && !channelProcess.killed) {
        isRunning = true;
        resolve({
          success: true,
          message: `TRIX Channel process started. server=http://47.243.55.130:8765 gateway=ws://127.0.0.1:18789`
        });
      }
    }, 5000);

    channelProcess.stdout.on('data', (buffer) => {
      const text = buffer.toString();
      if (text.includes('running') || text.includes('start')) {
        if (!isRunning) {
          isRunning = true;
          clearTimeout(timeout);
          resolve({
            success: true,
            message: 'TRIX Channel started successfully'
          });
        }
      }
    });

    channelProcess.stderr.on('data', (buffer) => {
      const text = buffer.toString().trim();
      if (text) {
        console.error('[TRIX Channel Error]', text);
      }
    });

    channelProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start TRIX Channel: ${error.message}`));
    });

    channelProcess.on('exit', (code) => {
      clearTimeout(timeout);
      console.log(`[TRIXManager] channel exited: ${code}`);
      isRunning = false;
      channelProcess = null;
    });
  });
}

async function generatePairingCode() {
  if (!isRunning) {
    return {
      success: false,
      error: 'Channel not started. Run "start trix channel" first.'
    };
  }

  ensureChannelPath();
  const trixChannel = require(path.join(CHANNEL_PATH, 'index.js'));
  const result = await trixChannel.generatePairingCode();

  return {
    success: true,
    code: result.code,
    pairingId: result.pairingId,
    expiresAt: result.expiresAt,
    message: `Pairing code generated: ${result.code}`
  };
}

async function getStatus() {
  if (!isRunning) {
    return {
      success: true,
      isRunning: false,
      message: 'TRIX Channel is not running'
    };
  }

  ensureChannelPath();
  const trixChannel = require(path.join(CHANNEL_PATH, 'index.js'));
  const status = trixChannel.getStatus();

  return {
    success: true,
    isRunning: true,
    ...status,
    message: `server=${status.isConnectedToServer} gateway=${status.isConnectedToGateway}`
  };
}

async function stopChannel() {
  if (!isRunning) {
    return { success: true, message: 'TRIX Channel is not running' };
  }

  if (channelProcess) {
    channelProcess.kill('SIGTERM');
    channelProcess = null;
  }

  isRunning = false;
  return { success: true, message: 'TRIX Channel stopped' };
}

async function handler(params) {
  const message = String(params?.message || '').toLowerCase();

  if (message.includes('start') && message.includes('trix')) {
    return startChannel();
  }

  if (message.includes('generate') && message.includes('pair')) {
    return generatePairingCode();
  }

  if (message.includes('stop') && message.includes('trix')) {
    return stopChannel();
  }

  if (message.includes('status') && message.includes('trix')) {
    return getStatus();
  }

  return {
    success: true,
    message: 'Commands: start trix channel | generate trix pairing code | trix status | stop trix channel'
  };
}

module.exports = {
  name: 'trix-channel-manager',
  description: 'Manage TRIX App Channel process',
  version: '1.1.0',
  author: 'TRIX Team',
  handler,
  triggers: [
    'start trix channel',
    'generate trix pairing code',
    'trix status',
    'stop trix channel'
  ]
};
