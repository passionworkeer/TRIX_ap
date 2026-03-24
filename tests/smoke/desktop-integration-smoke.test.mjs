import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('Desktop IPC handlers are properly set up', () => {
  const ipcTs = read('desktop/src/main/ipc.ts');
  assert.equal(ipcTs.includes('setupIpcHandlers'), true, 'Should export setupIpcHandlers');
  assert.equal(ipcTs.includes('ipcMain.handle'), true, 'Should use ipcMain.handle for async IPC');
});

test('Desktop gateway manages child process lifecycle', () => {
  const gatewayTs = read('desktop/src/main/gateway.ts');
  assert.equal(gatewayTs.includes('startGateway'), true, 'Should export startGateway');
  assert.equal(gatewayTs.includes('stopGateway'), true, 'Should export stopGateway');
  assert.equal(gatewayTs.includes('getGatewayStatus'), true, 'Should export getGatewayStatus');
  assert.equal(gatewayTs.includes('spawn'), true, 'Should use spawn for child process');
});

test('Desktop config directory exists', () => {
  const configDir = 'desktop/src/main/config';
  assert.equal(fs.existsSync(configDir), true, 'Config directory should exist');
});

test('Desktop startup module exists', () => {
  const startupDir = 'desktop/src/main/startup';
  assert.equal(fs.existsSync(startupDir), true, 'Startup directory should exist');
});

test('Desktop renderer has both lumina and noir themes', () => {
  assert.equal(fs.existsSync('desktop/src/renderer/stitch/lumina'), true, 'Lumina theme should exist');
  assert.equal(fs.existsSync('desktop/src/renderer/stitch/noir'), true, 'Noir theme should exist');
  assert.equal(fs.existsSync('desktop/src/renderer/stitch/shared'), true, 'Shared theme utilities should exist');
});

test('Desktop float renderer exists', () => {
  assert.equal(fs.existsSync('desktop/src/renderer/float.tsx'), true, 'Float renderer should exist');
  const floatTsx = read('desktop/src/renderer/float.tsx');
  assert.equal(floatTsx.includes('bot-state:changed') || floatTsx.includes('botState'), true, 'Float renderer should handle bot state');
});

test('Desktop package.json has correct main entry', () => {
  const pkg = JSON.parse(read('desktop/package.json'));
  assert.equal(pkg.name, 'trix-companion-desktop');
  assert.equal(pkg.main.includes('dist-desktop/main/index.cjs'), true, 'Main entry should point to built output');
});

test('Web vitest config includes desktop exclusion', () => {
  const configTs = read('vitest.config.ts');
  assert.equal(configTs.includes("'desktop/**'"), true, 'Root vitest config should exclude desktop tests');
});

test('Desktop vitest config exists with proper setup', () => {
  assert.equal(fs.existsSync('desktop/vitest.config.ts'), true, 'Desktop vitest config should exist');
  const configTs = read('desktop/vitest.config.ts');
  assert.equal(configTs.includes('node'), true, 'Should have node environment for main process');
  assert.equal(configTs.includes('happy-dom'), true, 'Should have happy-dom for renderer');
});

test('All desktop test files have corresponding source', () => {
  const testFiles = [
    'desktop/src/main/gateway.test.ts',
    'desktop/src/main/ipc.test.ts',
    'desktop/src/main/openclaw.test.ts',
    'desktop/src/main/window-state.test.ts',
    'desktop/src/main/float-window.test.ts',
    'desktop/src/main/tray.test.ts',
  ];
  const sourceFiles = [
    'desktop/src/main/gateway.ts',
    'desktop/src/main/ipc.ts',
    'desktop/src/main/openclaw.ts',
    'desktop/src/main/window-state.ts',
    'desktop/src/main/float-window.ts',
    'desktop/src/main/tray.ts',
  ];
  testFiles.forEach((tf, i) => {
    assert.equal(fs.existsSync(tf), true, `Test ${tf} should exist`);
    assert.equal(fs.existsSync(sourceFiles[i]), true, `Source ${sourceFiles[i]} should exist`);
  });
});
