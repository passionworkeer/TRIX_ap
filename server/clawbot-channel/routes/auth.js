// ============================================
// Auth API 路由
// 邮箱登录、注册、刷新、当前用户、登出
// ============================================

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const { dbRun, dbGet, dbAll } = require('../config/database');

function success(res, data, message = '成功') {
  res.json({ success: true, message, data });
}

function error(res, message, status = 400, details = null) {
  const payload = { success: false, error: message };
  if (details) payload.details = details;
  res.status(status).json(payload);
}

function serverError(res, err) {
  console.error('[Auth API Error]', err);
  error(res, '服务器错误', 500);
}

function mapAuthErrorStatus(err) {
  const status = err?.status || err?.statusCode;
  if (typeof status === 'number') return status;
  return 400;
}

function mapSession(session) {
  if (!session) return null;
  return {
    id: session.access_token?.slice(0, 16) || `session_${Date.now()}`,
    user_id: session.user?.id || null,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    // Supabase returns expires_at (seconds), iOS expects ISO date
    expires_at: session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()
  };
}

const SUPPORTED_OAUTH_PROVIDERS = new Set(['apple', 'wechat']);

function mapOAuthAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    provider_user_id: row.provider_user_id,
    email: row.email || null,
    display_name: row.display_name || null,
    avatar_url: row.avatar_url || null,
    is_primary: Boolean(row.is_primary),
    linked_at: row.linked_at ? new Date(row.linked_at).toISOString() : new Date().toISOString(),
    last_used_at: row.last_used_at ? new Date(row.last_used_at).toISOString() : new Date().toISOString()
  };
}

function resolveProviderUserId(provider, body = {}) {
  if (typeof body.provider_user_id === 'string' && body.provider_user_id.trim()) {
    return body.provider_user_id.trim();
  }
  if (provider === 'apple') {
    return body.user_identifier || body.provider_user_id || null;
  }
  if (provider === 'wechat') {
    return body.openid || body.provider_user_id || null;
  }
  return null;
}

async function upsertOAuthAccount({
  userId,
  provider,
  providerUserId,
  email = null,
  displayName = null,
  avatarUrl = null,
  accessToken = null,
  refreshToken = null,
  expiresAt = null
}) {
  const existing = await dbGet(
    `SELECT id, is_primary FROM oauth_accounts WHERE user_id = ? AND provider = ?`,
    [userId, provider]
  );

  const total = await dbGet(
    `SELECT COUNT(1) AS count FROM oauth_accounts WHERE user_id = ?`,
    [userId]
  );

  const id = existing?.id || uuidv4();
  const isPrimary = existing ? Number(existing.is_primary || 0) : ((total?.count || 0) === 0 ? 1 : 0);

  await dbRun(
    `INSERT INTO oauth_accounts (
      id, user_id, provider, provider_user_id, email, display_name, avatar_url,
      access_token, refresh_token, expires_at, is_primary, linked_at, last_used_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, provider) DO UPDATE SET
      provider_user_id = excluded.provider_user_id,
      email = excluded.email,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      last_used_at = CURRENT_TIMESTAMP`,
    [
      id,
      userId,
      provider,
      providerUserId,
      email,
      displayName,
      avatarUrl,
      accessToken,
      refreshToken,
      expiresAt,
      isPrimary
    ]
  );

  return dbGet(`SELECT * FROM oauth_accounts WHERE id = ?`, [id]);
}

function toProfilePayload(profile, authUser) {
  const now = new Date().toISOString();
  const metadata = authUser?.user_metadata || {};
  const usernameFallback = (
    profile?.username ||
    metadata.username ||
    metadata.name ||
    (authUser?.email ? authUser.email.split('@')[0] : null) ||
    `user_${String(authUser?.id || '').slice(0, 8)}`
  );

  return {
    id: authUser?.id || profile?.id,
    username: usernameFallback,
    email: authUser?.email || profile?.email || null,
    avatar_url: profile?.avatar_url || metadata.avatar_url || null,
    full_name: profile?.full_name || metadata.full_name || metadata.name || usernameFallback,
    display_name: profile?.display_name || profile?.full_name || metadata.name || usernameFallback,
    bio: profile?.bio || null,
    points: Number(profile?.points || 0),
    is_studying: Boolean(profile?.is_studying || false),
    companion_id: profile?.companion_id || null,
    total_study_time: Number(profile?.total_study_time || 0),
    school: profile?.school || null,
    grade: profile?.grade || null,
    created_at: profile?.created_at || now,
    updated_at: profile?.updated_at || now
  };
}

async function ensureProfile(user, preferredUsername = null) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profileError && profile) {
    return profile;
  }

  const usernameFromEmail = user.email ? user.email.split('@')[0] : `user_${user.id.slice(0, 8)}`;
  const username = preferredUsername || usernameFromEmail;
  const now = new Date().toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      username,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || username,
      display_name: user.user_metadata?.name || username,
      email: user.email || null,
      points: 0,
      is_studying: false,
      total_study_time: 0,
      created_at: now,
      updated_at: now
    }, { onConflict: 'id' })
    .select('*')
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted;
}

function isEmailPasswordLogin(body) {
  return typeof body?.email === 'string' && typeof body?.password === 'string';
}

function isAppleLogin(body) {
  return typeof body?.identity_token === 'string' && body.identity_token.length > 0;
}

function isWeChatLogin(body) {
  return typeof body?.openid === 'string' && body.openid.length > 0 && typeof body?.access_token === 'string' && body.access_token.length > 0;
}

// POST /auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const body = req.body || {};

    // Email + password login
    if (isEmailPasswordLogin(body)) {
      const { email, password } = body;
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !data?.user || !data?.session) {
        return error(res, signInError?.message || '登录失败', mapAuthErrorStatus(signInError) || 401);
      }

      const profile = await ensureProfile(data.user);
      return success(res, {
        user: toProfilePayload(profile, data.user),
        session: mapSession(data.session)
      });
    }

    // Apple OIDC login
    if (isAppleLogin(body)) {
      const { identity_token, access_token, authorization_code } = body;
      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identity_token,
        access_token,
        nonce: authorization_code
      });
      if (signInError || !data?.user || !data?.session) {
        return error(res, signInError?.message || 'Apple 登录失败', mapAuthErrorStatus(signInError) || 401);
      }

      const profile = await ensureProfile(data.user);
      await upsertOAuthAccount({
        userId: data.user.id,
        provider: 'apple',
        providerUserId: body.user_identifier || data.user.id,
        email: data.user.email || null,
        displayName: profile?.display_name || profile?.full_name || null,
        avatarUrl: profile?.avatar_url || null,
        accessToken: identity_token || access_token || null,
        refreshToken: data.session?.refresh_token || null,
        expiresAt: data.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null
      });
      return success(res, {
        user: toProfilePayload(profile, data.user),
        session: mapSession(data.session)
      });
    }

    // WeChat OIDC login (requires provider configuration in Supabase Auth)
    if (isWeChatLogin(body)) {
      const { openid, access_token } = body;
      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'wechat',
        token: access_token,
        nonce: openid
      });
      if (signInError || !data?.user || !data?.session) {
        return error(res, signInError?.message || 'WeChat 登录失败', mapAuthErrorStatus(signInError) || 401);
      }

      const profile = await ensureProfile(data.user);
      await upsertOAuthAccount({
        userId: data.user.id,
        provider: 'wechat',
        providerUserId: openid,
        email: data.user.email || null,
        displayName: profile?.display_name || profile?.full_name || null,
        avatarUrl: profile?.avatar_url || null,
        accessToken: access_token,
        refreshToken: data.session?.refresh_token || null,
        expiresAt: data.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : null
      });
      return success(res, {
        user: toProfilePayload(profile, data.user),
        session: mapSession(data.session)
      });
    }

    return error(res, '登录参数无效', 400);
  } catch (err) {
    serverError(res, err);
  }
});

// POST /auth/register
router.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return error(res, '缺少 username/email/password', 400);
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          full_name: username,
          name: username
        }
      }
    });

    if (signUpError || !data?.user) {
      return error(res, signUpError?.message || '注册失败', mapAuthErrorStatus(signUpError));
    }

    const profile = await ensureProfile(data.user, username);
    return success(res, toProfilePayload(profile, data.user), '注册成功');
  } catch (err) {
    serverError(res, err);
  }
});

// POST /auth/refresh
router.post('/auth/refresh', async (req, res) => {
  try {
    const { refresh_token, refreshToken } = req.body || {};
    const token = refresh_token || refreshToken;
    if (!token) {
      return error(res, '缺少 refresh_token', 400);
    }

    const { data, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: token
    });

    if (refreshError || !data?.user || !data?.session) {
      return error(res, refreshError?.message || '刷新失败', mapAuthErrorStatus(refreshError) || 401);
    }

    const profile = await ensureProfile(data.user);
    return success(res, {
      user: toProfilePayload(profile, data.user),
      session: mapSession(data.session)
    });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /auth/me
router.get('/auth/me', authMiddleware, async (req, res) => {
  try {
    const profile = await ensureProfile(req.user);
    return success(res, toProfilePayload(profile, req.user));
  } catch (err) {
    serverError(res, err);
  }
});

// POST /auth/logout
router.post('/auth/logout', authMiddleware, async (_req, res) => {
  // JWT token is stateless, client should discard it.
  return success(res, null, '已退出登录');
});

// GET /user/oauth/accounts
router.get('/user/oauth/accounts', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT * FROM oauth_accounts WHERE user_id = ? ORDER BY linked_at DESC`,
      [req.userId]
    );
    return success(res, rows.map(mapOAuthAccount));
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /user/oauth/link
router.post('/user/oauth/link', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const provider = String(body.provider || '').toLowerCase();
    if (!SUPPORTED_OAUTH_PROVIDERS.has(provider)) {
      return error(res, '不支持的 OAuth provider', 400);
    }

    const providerUserId = resolveProviderUserId(provider, body);
    if (!providerUserId) {
      return error(res, '缺少 provider_user_id', 400);
    }

    const linked = await upsertOAuthAccount({
      userId: req.userId,
      provider,
      providerUserId,
      email: body.email || req.user?.email || null,
      displayName: body.display_name || body.displayName || req.user?.user_metadata?.name || null,
      avatarUrl: body.avatar_url || body.avatarUrl || req.user?.user_metadata?.avatar_url || null,
      accessToken: body.access_token || body.accessToken || null,
      refreshToken: body.refresh_token || body.refreshToken || null,
      expiresAt: body.expires_at || body.expiresAt || null
    });

    return success(res, mapOAuthAccount(linked), '绑定成功');
  } catch (err) {
    return serverError(res, err);
  }
});

// POST /user/oauth/unlink
router.post('/user/oauth/unlink', authMiddleware, async (req, res) => {
  try {
    const { account_id, accountID, provider } = req.body || {};
    let target = null;

    if (account_id || accountID) {
      target = await dbGet(
        `SELECT * FROM oauth_accounts WHERE user_id = ? AND id = ?`,
        [req.userId, account_id || accountID]
      );
    } else if (provider) {
      target = await dbGet(
        `SELECT * FROM oauth_accounts WHERE user_id = ? AND provider = ?`,
        [req.userId, String(provider).toLowerCase()]
      );
    }

    if (!target) {
      return error(res, 'Account not found', 404);
    }

    const total = await dbGet(
      `SELECT COUNT(1) AS count FROM oauth_accounts WHERE user_id = ?`,
      [req.userId]
    );

    if ((total?.count || 0) <= 1) {
      return error(res, 'Cannot unlink your only authentication method', 400);
    }

    await dbRun(
      `DELETE FROM oauth_accounts WHERE user_id = ? AND id = ?`,
      [req.userId, target.id]
    );

    if (Number(target.is_primary || 0) === 1) {
      const replacement = await dbGet(
        `SELECT id FROM oauth_accounts WHERE user_id = ? ORDER BY linked_at ASC LIMIT 1`,
        [req.userId]
      );
      if (replacement?.id) {
        await dbRun(`UPDATE oauth_accounts SET is_primary = 0 WHERE user_id = ?`, [req.userId]);
        await dbRun(`UPDATE oauth_accounts SET is_primary = 1 WHERE id = ?`, [replacement.id]);
      }
    }

    return success(res, null, '解绑成功');
  } catch (err) {
    return serverError(res, err);
  }
});

module.exports = router;
