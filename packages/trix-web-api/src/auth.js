import crypto from 'crypto';
import { pool, withTransaction } from './db.js';
import { conflict, unauthorized } from './errors.js';

const TOKEN_TTL_SECONDS = Number.parseInt(process.env.JWT_EXPIRES_SECONDS ?? '86400', 10);
const DEV_SECRET = 'trix-dev-secret-change-me';

function secret() {
  const configured = process.env.JWT_SECRET || process.env.TRIX_API_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET or TRIX_API_SECRET must be configured in production');
  }
  return DEV_SECRET;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createToken(user) {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = base64url(JSON.stringify({ sub: user.id, email: user.email, exp: expiresAt }));
  const signature = signPayload(payload);
  return {
    token: `${payload}.${signature}`,
    expiresAt,
  };
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw unauthorized();
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature || signature !== signPayload(payload)) {
    throw unauthorized();
  }

  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!decoded.sub || decoded.exp < Math.floor(Date.now() / 1000)) {
    throw unauthorized();
  }

  return decoded;
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    aud: 'authenticated',
    role: 'authenticated',
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_metadata: {
      username: row.username,
      full_name: row.full_name,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    },
    app_metadata: {},
  };
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString('base64url'));
    });
  });
  return `${salt}:${derived}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  const actual = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString('base64url'));
    });
  });
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function findUserById(id, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT u.id, u.email, u.username, u.password_hash, u.created_at, u.updated_at,
            p.full_name, p.display_name, p.avatar_url, p.bio
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
      WHERE u.id = ?
      LIMIT 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findUserByEmail(email, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT u.id, u.email, u.username, u.password_hash, u.created_at, u.updated_at,
            p.full_name, p.display_name, p.avatar_url, p.bio
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
      WHERE u.email = ?
      LIMIT 1`,
    [email],
  );
  return rows[0] ?? null;
}

export async function registerUser({ id, email, username, password }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw conflict('该邮箱已被注册，请直接登录');
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  return withTransaction(async (connection) => {
    await connection.execute(
      'INSERT INTO users (id, email, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, username, passwordHash, now, now],
    );
    await connection.execute(
      `INSERT INTO profiles
        (id, username, email, display_name, full_name, points, total_study_time, current_streak, days_active, interaction_count, show_online_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, true, ?, ?)`,
      [id, username, email, username, username, now, now],
    );
    await connection.execute(
      'INSERT INTO user_points (id, user_id, total_points, level, total_earned, total_spent, created_at, updated_at) VALUES (?, ?, 0, 1, 0, 0, ?, ?)',
      [crypto.randomUUID(), id, now, now],
    );
    return findUserById(id, connection);
  });
}
