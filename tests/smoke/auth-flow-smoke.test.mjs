import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('Auth routes should export Login and Register components', () => {
  const authTsx = read('src/screens/Auth.tsx');

  // Login and Register should be named exports
  assert.equal(authTsx.includes('export const Login: React.FC'), true, 'Login should be a named export');
  assert.equal(authTsx.includes('export const Register: React.FC'), true, 'Register should be a named export');
});

test('Login component should have email and password inputs', () => {
  const authTsx = read('src/screens/Auth.tsx');

  // Login should have email input
  assert.equal(authTsx.includes('id="email-input"'), true, 'Login should have email input with id');
  assert.equal(authTsx.includes('type="email"'), true, 'Login should have email input type');

  // Login should have password input
  assert.equal(authTsx.includes('id="password-input"'), true, 'Login should have password input with id');
  assert.equal(authTsx.includes('type="password"'), true, 'Login should have password input type');

  // Login should have submit button
  assert.equal(authTsx.includes('handleLogin'), true, 'Login should have handleLogin function');
});

test('Register component should have username, email, and password fields', () => {
  const authTsx = read('src/screens/Auth.tsx');

  // Register should handle username
  assert.equal(authTsx.includes("setUsername"), true, 'Register should manage username state');
  assert.equal(authTsx.includes('handleRegister'), true, 'Register should have handleRegister function');
  assert.equal(authTsx.includes('signUp'), true, 'Register should call signUp from useAuth');

  // Register should have form validation
  assert.equal(authTsx.includes('validateString'), true, 'Register should use validateString for form validation');
});

test('Login and Register should use AppRoutes for navigation', () => {
  const authTsx = read('src/screens/Auth.tsx');

  // Both should use AppRoutes for navigation
  assert.equal(authTsx.includes('AppRoutes.LOGIN'), true, 'Should use AppRoutes.LOGIN for navigation');
  assert.equal(authTsx.includes('AppRoutes.REGISTER'), true, 'Should use AppRoutes.REGISTER for navigation');
});

test('Auth components should use i18n translations', () => {
  const authTsx = read('src/screens/Auth.tsx');

  assert.equal(authTsx.includes("useTranslation()"), true, 'Auth should use useTranslation hook');
  assert.equal(authTsx.includes("t('auth."), true, 'Auth should use auth translation keys');
});
