import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createToken,
  hashPassword,
  publicUser,
  verifyPassword,
  verifyToken,
} from './auth.js';

process.env.JWT_SECRET = 'trix-web-api-test-secret';

test('password hashes verify only the original password', async () => {
  const hash = await hashPassword('demo-password');

  assert.notEqual(hash, 'demo-password');
  assert.equal(await verifyPassword('demo-password', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});

test('tokens round-trip signed user claims', () => {
  const token = createToken({ id: 'user-1', email: 'user@example.com' });
  const payload = verifyToken(token.token);

  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.email, 'user@example.com');
  assert.equal(payload.exp, token.expiresAt);
  assert.throws(() => verifyToken('invalid-token'));
});

test('publicUser strips private fields and maps metadata', () => {
  const user = publicUser({
    id: 'user-1',
    email: 'user@example.com',
    username: 'testuser',
    password_hash: 'private',
    full_name: 'Test User',
    display_name: 'Tester',
    avatar_url: 'https://example.com/avatar.png',
    created_at: '2026-05-30T00:00:00.000Z',
    updated_at: '2026-05-30T00:00:00.000Z',
  });

  assert.equal(user.id, 'user-1');
  assert.equal(user.email, 'user@example.com');
  assert.equal(user.username, 'testuser');
  assert.equal(user.user_metadata.full_name, 'Test User');
  assert.equal(user.user_metadata.display_name, 'Tester');
  assert.equal(user.user_metadata.avatar_url, 'https://example.com/avatar.png');
  assert.equal(Object.hasOwn(user, 'password_hash'), false);
});
