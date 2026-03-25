import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('Profile page should be defined in App.tsx', () => {
  const appTsx = read('src/App.tsx');

  // Profile should be a route
  assert.equal(appTsx.includes('AppRoutes.PROFILE'), true, 'App should define Profile route');
  assert.equal(appTsx.includes('/profile/:userId'), true, 'App should define /profile/:userId route');
});

test('Profile page should import required hooks and contexts', () => {
  const profileTsx = read('src/screens/Profile.tsx');

  // Profile should use auth context
  assert.equal(profileTsx.includes("useAuth()"), true, 'Profile should use useAuth hook');
  assert.equal(profileTsx.includes('user'), true, 'Profile should access user from auth');
  assert.equal(profileTsx.includes('profile'), true, 'Profile should access profile from auth');

  // Profile should use theme context
  assert.equal(profileTsx.includes("useTheme()"), true, 'Profile should use useTheme hook');
});

test('Profile page should display user stats', () => {
  const profileTsx = read('src/screens/Profile.tsx');

  // Stats: daysActive, points, interactions
  assert.equal(profileTsx.includes('days_active'), true, 'Profile should show days_active stat');
  assert.equal(profileTsx.includes('points'), true, 'Profile should show points stat');
  assert.equal(profileTsx.includes('interaction_count'), true, 'Profile should show interaction_count');
});

test('Profile page should have navigation and settings controls', () => {
  const profileTsx = read('src/screens/Profile.tsx');

  // Profile should navigate to other routes
  assert.equal(profileTsx.includes('AppRoutes.POINTS_MALL'), true, 'Profile should link to Points Mall');
  assert.equal(profileTsx.includes('AppRoutes.WARDROBE'), true, 'Profile should link to Wardrobe');
  assert.equal(profileTsx.includes('AppRoutes.LOGIN'), true, 'Profile should navigate to login on logout');
});

test('Profile page should support theme toggle', () => {
  const profileTsx = read('src/screens/Profile.tsx');

  // Dark mode toggle
  assert.equal(profileTsx.includes('toggleTheme'), true, 'Profile should have toggleTheme function');
  assert.equal(profileTsx.includes('isDark'), true, 'Profile should check isDark state');
});

test('Profile page should use i18n translations', () => {
  const profileTsx = read('src/screens/Profile.tsx');

  assert.equal(profileTsx.includes("useTranslation()"), true, 'Profile should use useTranslation hook');
  assert.equal(profileTsx.includes("t('profile."), true, 'Profile should use profile translation keys');
});
