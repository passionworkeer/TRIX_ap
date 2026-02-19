import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
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
