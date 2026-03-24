import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('Desktop main process entry point exists', () => {
  assert.equal(fs.existsSync('desktop/src/main/index.ts'), true, 'Main process entry should exist');
  const mainTs = read('desktop/src/main/index.ts');
  assert.equal(mainTs.includes('app'), true, 'Main should import electron app');
  assert.equal(mainTs.includes('BrowserWindow'), true, 'Main should import BrowserWindow');
});

test('Desktop IPC handlers use app.getPath for userData', () => {
  const ipcTs = read('desktop/src/main/ipc.ts');
  // Ensure no process.cwd() usage for paths
  assert.equal(ipcTs.includes('process.cwd()'), false, 'IPC should not use process.cwd() for paths');
});

test('Desktop gateway uses proper port configuration', () => {
  const gatewayTs = read('desktop/src/main/gateway.ts');
  assert.equal(gatewayTs.includes('18789'), true, 'Gateway should use port 18789');
});

test('Desktop float window is frameless and always-on-top', () => {
  const floatTs = read('desktop/src/main/float-window.ts');
  assert.equal(floatTs.includes('frame: false'), true, 'Float window should be frameless');
  assert.equal(floatTs.includes('alwaysOnTop: true'), true, 'Float window should be always-on-top');
  assert.equal(floatTs.includes('skipTaskbar: true'), true, 'Float window should skip taskbar');
});

test('Desktop tray has proper menu items', () => {
  const trayTs = read('desktop/src/main/tray.ts');
  assert.equal(trayTs.includes('显示主窗口'), true, 'Tray should have show window option');
  assert.equal(trayTs.includes('隐藏主窗口'), true, 'Tray should have hide window option');
  assert.equal(trayTs.includes('重启 Gateway'), true, 'Tray should have restart gateway option');
  assert.equal(trayTs.includes('退出'), true, 'Tray should have exit option');
});

test('Desktop window-state manages main and float windows', () => {
  const wsTs = read('desktop/src/main/window-state.ts');
  assert.equal(wsTs.includes('_mainWindow'), true, 'Window state should track main window');
  assert.equal(wsTs.includes('_floatWindow'), true, 'Window state should track float window');
  assert.equal(wsTs.includes('pushBotState'), true, 'Window state should support pushBotState');
  assert.equal(wsTs.includes("send('bot-state:changed'"), true, 'Window state should send bot state to float');
});

test('Desktop openclaw module exports required functions', () => {
  const ocTs = read('desktop/src/main/openclaw.ts');
  assert.equal(ocTs.includes('runOpenClawCommand'), true, 'Should export runOpenClawCommand');
});

test('Desktop vitest config properly separates main and renderer tests', () => {
  const configTs = read('desktop/vitest.config.ts');
  assert.equal(configTs.includes('environmentMatchGlobs'), true, 'Should use environmentMatchGlobs');
  assert.equal(configTs.includes("['src/main/**/*.test.ts', 'node']"), true, 'Main tests should use node environment');
  assert.equal(configTs.includes("['src/renderer/**/*.test.tsx', 'happy-dom']"), true, 'Renderer tests should use happy-dom');
});

test('Desktop renderer has stitch component tests for both themes', () => {
  assert.equal(fs.existsSync('desktop/src/renderer/stitch/lumina/components/buttons.test.tsx'), true, 'Lumina buttons test should exist');
  assert.equal(fs.existsSync('desktop/src/renderer/stitch/lumina/components/cards.test.tsx'), true, 'Lumina cards test should exist');
  assert.equal(fs.existsSync('desktop/src/renderer/stitch/lumina/components/Sidebar.test.tsx'), true, 'Lumina Sidebar test should exist');
  assert.equal(fs.existsSync('desktop/src/renderer/stitch/noir/components/DarkButton.test.tsx'), true, 'Noir DarkButton test should exist');
  assert.equal(fs.existsSync('desktop/src/renderer/stitch/noir/components/DarkCard.test.tsx'), true, 'Noir DarkCard test should exist');
  assert.equal(fs.existsSync('desktop/src/renderer/stitch/shared/cn.test.ts'), true, 'Shared cn utility test should exist');
});
