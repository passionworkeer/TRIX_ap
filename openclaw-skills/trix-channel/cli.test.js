'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cliPath = path.join(__dirname, 'cli.js');
const packageJson = require('./package.json');

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: __dirname,
    env: process.env,
    encoding: 'utf8'
  });
}

test('prints version without starting the channel', () => {
  const result = runCli(['--version']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
  assert.equal(result.stderr.trim(), '');
});

test('prints help text', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /trix-channel pair/);
  assert.match(result.stdout, /trix-channel status/);
});

test('returns a non-zero exit code for an unknown command', () => {
  const result = runCli(['unknown-command']);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown command/);
});

test('prints JSON status without starting network connections', () => {
  const result = runCli(['status', '--json']);
  assert.equal(result.status, 0);
  const status = JSON.parse(result.stdout);
  assert.equal(typeof status.isConnectedToServer, 'boolean');
  assert.equal(typeof status.isConnectedToGateway, 'boolean');
  assert.equal(typeof status.serverUrl, 'string');
  assert.equal(typeof status.gatewayUrl, 'string');
});
