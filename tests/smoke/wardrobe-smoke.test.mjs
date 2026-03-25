import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('Wardrobe page should be defined in App.tsx', () => {
  const appTsx = read('src/App.tsx');

  // Wardrobe should be a route
  assert.equal(appTsx.includes('AppRoutes.WARDROBE'), true, 'App should define Wardrobe route');
  assert.equal(appTsx.includes('Wardrobe'), true, 'App should import Wardrobe screen');
});

test('Wardrobe page should import outfit management components', () => {
  const wardrobeTsx = read('src/screens/Wardrobe.tsx');

  // Wardrobe should use wardrobe service
  assert.equal(wardrobeTsx.includes("from '../services/wardrobeService'"), true, 'Wardrobe should import wardrobeService');

  // Wardrobe should use OutfitCard component
  assert.equal(wardrobeTsx.includes('import OutfitCard from'), true, 'Wardrobe should import OutfitCard');
  assert.equal(wardrobeTsx.includes('import OutfitPreview from'), true, 'Wardrobe should import OutfitPreview');
});

test('Wardrobe page should manage outfit state and categories', () => {
  const wardrobeTsx = read('src/screens/Wardrobe.tsx');

  // State management for outfits
  assert.equal(wardrobeTsx.includes('useState<Outfit[]>'), true, 'Wardrobe should manage outfits state');
  assert.equal(wardrobeTsx.includes('selectedCategory'), true, 'Wardrobe should track selectedCategory');
  assert.equal(wardrobeTsx.includes('OutfitCategoryFilter'), true, 'Wardrobe should use OutfitCategoryFilter type');
});

test('Wardrobe page should support equip and unequip actions', () => {
  const wardrobeTsx = read('src/screens/Wardrobe.tsx');

  // Equip/unequip functionality
  assert.equal(wardrobeTsx.includes('equipOutfit'), true, 'Wardrobe should have equipOutfit function');
  assert.equal(wardrobeTsx.includes('unequipOutfit'), true, 'Wardrobe should have unequipOutfit function');
  assert.equal(wardrobeTsx.includes('handleEquipToggle'), true, 'Wardrobe should have handleEquipToggle handler');
});

test('Wardrobe page should load wardrobe summary', () => {
  const wardrobeTsx = read('src/screens/Wardrobe.tsx');

  assert.equal(wardrobeTsx.includes('getUserWardrobeSummary'), true, 'Wardrobe should call getUserWardrobeSummary');
  assert.equal(wardrobeTsx.includes('wardrobeSummary'), true, 'Wardrobe should manage wardrobeSummary state');
});

test('Wardrobe page should support navigation', () => {
  const wardrobeTsx = read('src/screens/Wardrobe.tsx');

  assert.equal(wardrobeTsx.includes('useNavigate'), true, 'Wardrobe should use useNavigate hook');
  assert.equal(wardrobeTsx.includes('handleBack'), true, 'Wardrobe should have handleBack function');
});
