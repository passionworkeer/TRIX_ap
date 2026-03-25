import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('PointsMall page should be defined in App.tsx', () => {
  const appTsx = read('src/App.tsx');

  // PointsMall should be a route
  assert.equal(appTsx.includes('AppRoutes.POINTS_MALL'), true, 'App should define PointsMall route');
  assert.equal(appTsx.includes('PointsMall'), true, 'App should import PointsMall screen');
});

test('PointsMall page should import mall service', () => {
  const pointsMallTsx = read('src/screens/PointsMall.tsx');

  // PointsMall should use mallService
  assert.equal(pointsMallTsx.includes("from '../services/mallService'"), true, 'PointsMall should import mallService');

  // Should import mall types
  assert.equal(pointsMallTsx.includes("from '../types/mall'"), true, 'PointsMall should import mall types');
});

test('PointsMall page should manage items and points balance state', () => {
  const pointsMallTsx = read('src/screens/PointsMall.tsx');

  // State management
  assert.equal(pointsMallTsx.includes('useState<MallItem[]>'), true, 'PointsMall should manage items state');
  assert.equal(pointsMallTsx.includes('PointsBalance'), true, 'PointsMall should use PointsBalance type');
  assert.equal(pointsMallTsx.includes('pointsBalance'), true, 'PointsMall should track pointsBalance');
});

test('PointsMall page should support category filtering', () => {
  const pointsMallTsx = read('src/screens/PointsMall.tsx');

  // Category filtering
  assert.equal(pointsMallTsx.includes('selectedCategory'), true, 'PointsMall should track selectedCategory');
  assert.equal(pointsMallTsx.includes('MallCategory'), true, 'PointsMall should use MallCategory type');
  assert.equal(pointsMallTsx.includes('clothing'), true, 'PointsMall should support clothing category');
  assert.equal(pointsMallTsx.includes('accessory'), true, 'PointsMall should support accessory category');
  assert.equal(pointsMallTsx.includes('prop'), true, 'PointsMall should support prop category');
});

test('PointsMall page should support purchase functionality', () => {
  const pointsMallTsx = read('src/screens/PointsMall.tsx');

  // Purchase functionality
  assert.equal(pointsMallTsx.includes('purchaseItem'), true, 'PointsMall should have purchaseItem function');
  assert.equal(pointsMallTsx.includes('handlePurchase'), true, 'PointsMall should have handlePurchase handler');
  assert.equal(pointsMallTsx.includes('isPurchasing'), true, 'PointsMall should track isPurchasing state');
});

test('PointsMall page should load mall items and balance', () => {
  const pointsMallTsx = read('src/screens/PointsMall.tsx');

  // Data loading
  assert.equal(pointsMallTsx.includes('getMallItems'), true, 'PointsMall should call getMallItems');
  assert.equal(pointsMallTsx.includes('getUserPointsBalance'), true, 'PointsMall should call getUserPointsBalance');
  assert.equal(pointsMallTsx.includes('loadItems'), true, 'PointsMall should have loadItems function');
  assert.equal(pointsMallTsx.includes('loadPointsBalance'), true, 'PointsMall should have loadPointsBalance function');
});
