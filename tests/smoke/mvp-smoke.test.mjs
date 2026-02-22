import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function collectSourceFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(fullPath.replace(/\\/g, '/'));
    }
  }

  return files;
}

test('MVP app routes should not expose token monitor entry', () => {
  const appTsx = read('src/App.tsx');
  const typesTs = read('src/types.ts');

  assert.equal(appTsx.includes('TOKEN_MONITOR'), false, 'App routes should not reference TOKEN_MONITOR');
  assert.equal(typesTs.includes('/token-monitor'), false, 'AppRoutes should not include token monitor path');
});

test('App route layer should use Suspense + lazy split for screens', () => {
  const appTsx = read('src/App.tsx');

  assert.equal(appTsx.includes('lazy(() => import('), true, 'Expected route screens to be lazy loaded');
  assert.equal(appTsx.includes('<Suspense fallback={<RouteLoading />}>'), true, 'Expected route suspense fallback');
});

test('Deploy script should only expose clawbot deployment flow', () => {
  const deployScript = read('deploy.sh');

  assert.equal(deployScript.includes('deploy_nanobot'), false, 'Nanobot deploy helper should be removed');
  assert.equal(deployScript.includes('nanobot)'), false, 'Nanobot command case should be removed');
  assert.equal(deployScript.includes('deploy_clawbot'), true, 'Clawbot deploy helper should remain');
});

test('Pairing page text should be valid UTF-8 Chinese copy (no mojibake placeholders)', () => {
  const pairingTsx = read('src/screens/Pairing.tsx');

  assert.equal(pairingTsx.includes('设备配对'), true, 'Expected normal pairing title copy');
  assert.equal(pairingTsx.includes('配对成功'), true, 'Expected normal success copy');
  assert.equal(pairingTsx.includes('�'), false, 'Pairing page contains mojibake replacement characters');
});

test('SnapMap should keep leaflet style and mock friends fallback for MVP', () => {
  const snapMap = read('src/screens/SnapMapScreen.tsx');

  assert.equal(snapMap.includes("import 'leaflet/dist/leaflet.css';"), true, 'Leaflet CSS import is required');
  assert.equal(snapMap.includes('const mockFriends: FriendLatestMessage[] = ['), true, 'Mock friends fallback should exist');
  assert.equal(snapMap.includes('setFriends(data.length > 0 ? data.slice(0, 3) : mockFriends);'), true, 'Expected fallback to mock friends');
});

test('Snapshot entry should require pairing and use unified TRIX avatar', () => {
  const appTsx = read('src/App.tsx');
  const snapshotTsx = read('src/screens/Snapshot.tsx');

  assert.equal(appTsx.includes('if (!isClawbotConnected || !isClawbotPaired)'), true, 'Home snapshot modal should gate by clawbot connection');
  assert.equal(appTsx.includes('navigate(AppRoutes.PAIRING);'), true, 'Home snapshot modal should redirect to pairing');
  assert.equal(appTsx.includes('avatar: IMAGES.WIZARD_BOY_LOGIN,'), true, 'Home snapshot modal should use unified TRIX avatar');

  assert.equal(snapshotTsx.includes('if (!isConnected || !isPaired)'), true, 'Snapshot upload flow should gate by clawbot connection');
  assert.equal(snapshotTsx.includes('navigate(AppRoutes.PAIRING);'), true, 'Snapshot upload flow should redirect to pairing');
  assert.equal(snapshotTsx.includes('avatar: IMAGES.WIZARD_BOY_LOGIN,'), true, 'Snapshot upload flow should use unified TRIX avatar');
});

test('Input fields on pairing flows should keep explicit dark text on light backgrounds', () => {
  const appTsx = read('src/App.tsx');
  const pairingTsx = read('src/screens/Pairing.tsx');
  const qrPairingTsx = read('src/screens/QRCodePairing.tsx');
  const addFriendModal = read('src/components/AddFriendModal.tsx');

  assert.equal(appTsx.includes("color: 'var(--text-primary)'"), false, 'App root should not force global text color inheritance');
  assert.equal(pairingTsx.includes('text-slate-900 placeholder:text-slate-400'), true, 'Pairing code input should have explicit dark text');
  assert.equal(qrPairingTsx.includes('text-slate-900 placeholder:text-slate-400'), true, 'QRCode pairing inputs should have explicit dark text');
  assert.equal(addFriendModal.includes('text-slate-900 placeholder:text-slate-400'), true, 'Add friend input should have explicit dark text');
});

test('Index HTML should not use Tailwind CDN and should use modern mobile web app meta', () => {
  const html = read('index.html');

  assert.equal(html.includes('https://cdn.tailwindcss.com'), false, 'Tailwind CDN must not be used');
  assert.equal(html.includes('name="mobile-web-app-capable"'), true, 'Expected modern mobile web app meta');
  assert.equal(html.includes('name="apple-mobile-web-app-capable"'), false, 'Deprecated Apple meta should be removed');
});

test('Production env checks should require canonical gateway vars and disallow loopback defaults', () => {
  const envTs = read('src/utils/env.ts');
  const endpointConfig = read('src/config/clawbotEndpoints.ts');
  const envProd = read('.env.production');
  const gatewayLine = envProd.split('\n').find((line) => line.startsWith('VITE_GATEWAY_WS_URL='));

  assert.equal(envTs.includes("'VITE_CLAWBOT_CHANNEL_URL'"), true, 'Production should require VITE_CLAWBOT_CHANNEL_URL');
  assert.equal(envTs.includes("'VITE_GATEWAY_WS_URL'"), true, 'Production should require VITE_GATEWAY_WS_URL');
  assert.equal(envTs.includes("'VITE_GATEWAY_AUTH_TOKEN'"), true, 'Production should require VITE_GATEWAY_AUTH_TOKEN');
  assert.equal(envTs.includes('Invalid production URL: loopback address is not allowed'), true, 'Loopback URLs should be rejected in production validation');
  assert.equal(endpointConfig.includes("return import.meta.env.DEV ? fallback : '';"), true, 'Endpoint fallback should only apply in development');
  assert.equal(Boolean(gatewayLine), true, '.env.production should define VITE_GATEWAY_WS_URL');
  assert.equal(gatewayLine?.includes('127.0.0.1') ?? false, false, 'Gateway WS URL should not use 127.0.0.1');
  assert.equal(gatewayLine?.includes('localhost') ?? false, false, 'Gateway WS URL should not use localhost');
});

test('Runtime src code should not use native alert/confirm dialogs', () => {
  const sourceFiles = collectSourceFiles('src');
  const dialogPattern = /(?:^|[^\w.])(?:alert|confirm)\s*\(/g;
  const offenders = [];

  for (const filePath of sourceFiles) {
    const content = read(filePath);
    if (dialogPattern.test(content)) {
      offenders.push(filePath);
    }
  }

  assert.deepEqual(offenders, [], `Native dialog calls found in: ${offenders.join(', ')}`);
});

test('Theme system should use class-based dark variant and avoid global background pollution selectors', () => {
  const css = read('src/index.css');
  const themeContext = read('src/contexts/ThemeContext.tsx');

  assert.equal(css.includes('@custom-variant dark (&:where(.dark, .dark *));'), true, 'Tailwind dark variant should follow .dark class');
  assert.equal(css.includes('div:not([data-hero-background]):not([data-home-scroll])'), false, 'Global div background override should be removed');
  assert.equal(css.includes('.overflow-y-auto:not([data-home-scroll])'), false, 'Global overflow-y background override should be removed');
  assert.equal(css.includes('.overscroll-safe'), true, 'Scoped overscroll-safe class should exist');
  assert.equal(themeContext.includes("type ThemeMode = 'system' | 'light' | 'dark'"), true, 'ThemeContext should expose ThemeMode');
  assert.equal(themeContext.includes("const [themeMode, setThemeModeState]"), true, 'ThemeContext should persist themeMode');
  assert.equal(themeContext.includes("window.matchMedia('(prefers-color-scheme: dark)')"), true, 'ThemeContext should watch system preference');
});

test('ChatDetail should use deterministic AI prefix replacement and IME-safe enter-send', () => {
  const chatDetail = read('src/screens/ChatDetail.tsx');
  const aiPrompt = read('src/features/chat/utils/aiPrompt.ts');
  const aiSelector = read('src/components/AIActionSelector.tsx');

  assert.equal(chatDetail.includes('requestConfirm({'), true, 'Unpair flow should use custom confirm modal');
  assert.equal(chatDetail.includes('applyAIActionPrefix(previous, action)'), true, 'AI action should replace prefix deterministically');
  assert.equal(chatDetail.includes('detectAIActionFromInput(input)'), true, 'AI action state should derive from input');
  assert.equal(chatDetail.includes('!event.nativeEvent.isComposing'), true, 'Enter send should guard IME composition');
  assert.equal(chatDetail.includes('value={selectedAIAction}'), true, 'AI selector should be controlled');

  assert.equal(aiPrompt.includes("chat: ''"), true, 'chat action should clear prefix');
  assert.equal(aiPrompt.includes('removeLeadingKnownPrefix'), true, 'AI prefix cleanup helper should exist');
  assert.equal(aiSelector.includes('aria-pressed={isSelected}'), true, 'AI selector should expose selected state');
  assert.equal(aiSelector.includes('dark:'), true, 'AI selector should define dark mode classes');
});
