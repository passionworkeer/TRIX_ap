#!/usr/bin/env node
'use strict';

const path = require('path');
const util = require('util');

const argv = process.argv.slice(2);
const packageJson = require('./package.json');

function printUsage(stream = process.stdout) {
  stream.write(
    [
      'Usage:',
      '  trix-channel',
      '  trix-channel start',
      '  trix-channel run',
      '  trix-channel pair [--json] [--code-only]',
      '  trix-channel status [--json]',
      '  trix-channel --help',
      '  trix-channel --version',
      '',
      'Commands:',
      '  start, run    Start the TRIX channel and keep it running',
      '  pair          Start the channel and print a fresh pairing code',
      '  status        Show the current channel status',
      '',
      'Options:',
      '  --json        Print machine-readable JSON',
      '  --code-only   Print only the pairing code',
      '  --help        Show this help message',
      '  --version     Show package version'
    ].join('\n') + '\n'
  );
}

function hasAnyFlag(flags, names) {
  return names.some((name) => flags.includes(name));
}

function normalizeCommand(rawCommand) {
  const value = String(rawCommand || '').trim().toLowerCase();
  if (!value) {
    return 'start';
  }
  if (value === 'start' || value === 'run' || value === 'pair' || value === 'status') {
    return value;
  }
  return '';
}

function formatTimestamp(value) {
  if (!value) {
    return 'n/a';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toISOString();
}

function renderQr(qrData) {
  if (!qrData) {
    return;
  }
  try {
    const qrcode = require('qrcode-terminal');
    qrcode.generate(qrData, { small: true });
  } catch (error) {
    console.error('[TRIXChannel] failed to render terminal QR:', error.message);
    console.log(qrData);
  }
}

function printPairingResult(result, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (options.codeOnly) {
    if (result.code) {
      console.log(result.code);
    }
    return;
  }

  console.log(`[TRIXChannel] Pairing code: ${result.code || 'n/a'}`);
  console.log(`[TRIXChannel] Expires at: ${formatTimestamp(result.expiresAt)}`);
  if (result.pairingId) {
    console.log(`[TRIXChannel] Pairing ID: ${result.pairingId}`);
  }
  if (result.pairingToken) {
    console.log(`[TRIXChannel] Pairing token: ${result.pairingToken}`);
  }
  if (result.qrData) {
    console.log('[TRIXChannel] Scan this QR code in the TRIX mobile app:');
    renderQr(result.qrData);
    return;
  }
  console.log('[TRIXChannel] Open the mobile app and enter the pairing code manually.');
}

function printStatus(status, asJson) {
  if (asJson) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  const lines = [
    'TRIX Channel status',
    `  server: ${status.isConnectedToServer ? 'connected' : 'disconnected'}`,
    `  gateway: ${status.isConnectedToGateway ? 'connected' : 'disconnected'}`,
    `  serverUrl: ${status.serverUrl || 'n/a'}`,
    `  gatewayUrl: ${status.gatewayUrl || 'n/a'}`,
    `  deviceId: ${status.deviceId || 'n/a'}`,
    `  pairingId: ${status.pairingId || 'n/a'}`,
    `  agentId: ${status.trixAgentId || 'n/a'}`,
    `  persistentAuth: ${status.hasPersistentAuth ? 'yes' : 'no'}`,
    `  cliBridge: ${status.cliBridgeEnabled ? 'enabled' : 'disabled'}`,
    `  gatewayBridge: ${status.gatewayBridgeEnabled ? 'enabled' : 'disabled'}`
  ];
  console.log(lines.join('\n'));
}

function redirectLogsToStderr() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  console.log = (...args) => {
    process.stderr.write(`${util.format(...args)}\n`);
  };
  console.warn = (...args) => {
    process.stderr.write(`${util.format(...args)}\n`);
  };
  return () => {
    console.log = originalLog;
    console.warn = originalWarn;
  };
}

async function main() {
  if (hasAnyFlag(argv, ['--help', '-h'])) {
    printUsage();
    return;
  }

  if (hasAnyFlag(argv, ['--version', '-v'])) {
    console.log(packageJson.version);
    return;
  }

  const rawCommand = argv[0] && !argv[0].startsWith('-') ? argv[0] : '';
  const command = normalizeCommand(rawCommand);
  if (!command) {
    console.error(`Unknown command: ${rawCommand}`);
    printUsage(process.stderr);
    process.exitCode = 1;
    return;
  }

  const flagArgs = rawCommand ? argv.slice(1) : argv;
  const json = hasAnyFlag(flagArgs, ['--json']);
  const codeOnly = hasAnyFlag(flagArgs, ['--code-only']);

  if (command === 'pair') {
    process.env.TRIX_SUPPRESS_STARTUP_PAIRING = 'true';
  }

  const channel = require('./index.js');
  let stopping = false;

  const shutdown = async (exitCode = 0) => {
    if (stopping) {
      return;
    }
    stopping = true;
    try {
      await channel.stop();
    } catch (error) {
      console.error('[TRIXChannel] failed to stop cleanly:', error.message);
      process.exit(exitCode || 1);
      return;
    }
    process.exit(exitCode);
  };

  process.on('SIGINT', () => {
    shutdown(0);
  });
  process.on('SIGTERM', () => {
    shutdown(0);
  });

  if (command === 'status') {
    printStatus(channel.getStatus(), json);
    return;
  }

  let restoreLogs = null;
  if (command === 'pair' && (json || codeOnly)) {
    restoreLogs = redirectLogsToStderr();
  }

  try {
    await channel.start();

    if (command === 'pair') {
      const result = await channel.generatePairingCode(true);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to generate pairing code');
      }
      if (restoreLogs) {
        restoreLogs();
        restoreLogs = null;
      }
      printPairingResult(result, { json, codeOnly });
      const waitMessage = '[TRIXChannel] waiting for mobile pairing, press Ctrl+C to stop';
      if (json || codeOnly) {
        process.stderr.write(`${waitMessage}\n`);
      } else {
        console.log(waitMessage);
      }
      return;
    }
  } finally {
    if (restoreLogs) {
      restoreLogs();
    }
  }

  console.log(`[TRIXChannel] running from ${path.resolve(__dirname)}, press Ctrl+C to stop`);
}

main().catch((error) => {
  console.error('[TRIXChannel] CLI failed:', error.message);
  process.exit(1);
});
