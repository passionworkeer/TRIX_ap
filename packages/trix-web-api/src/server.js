import './env.js';
import crypto from 'crypto';
import express from 'express';
import { publicUser, registerUser, createToken, findUserByEmail, findUserById, verifyPassword, verifyToken } from './auth.js';
import { pool, pingDatabase, withTransaction } from './db.js';
import { deleteRows, insertRows, selectRows, updateRows } from './crud.js';
import { HttpError, badRequest, forbidden, unauthorized } from './errors.js';

const app = express();
const port = Number.parseInt(process.env.PORT ?? process.env.TRIX_WEB_API_PORT ?? '8789', 10);
const AUTH_COOKIE_NAME = process.env.TRIX_AUTH_COOKIE_NAME ?? 'trix_auth_token';
const SESSION_TOKEN_PLACEHOLDER = 'cookie';
const FRIEND_REQUEST_META_PREFIX = '[friend_request_from:]';

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function authenticate(req, _res, next) {
  try {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const token = parseCookies(req.headers.cookie)[AUTH_COOKIE_NAME] ?? (bearer?.includes('.') ? bearer : null);
    const payload = verifyToken(token);
    const user = await findUserById(payload.sub);
    if (!user) throw unauthorized();
    req.user = publicUser(user);
    next();
  } catch (error) {
    next(error);
  }
}

function makeSession(user, tokenPayload) {
  return {
    access_token: SESSION_TOKEN_PLACEHOLDER,
    refresh_token: SESSION_TOKEN_PLACEHOLDER,
    token_type: 'bearer',
    expires_at: tokenPayload.expiresAt,
    expires_in: tokenPayload.expiresAt - Math.floor(Date.now() / 1000),
    user,
  };
}

function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    String(header)
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function authCookie(token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure}`;
}

function setAuthCookie(res, tokenPayload) {
  res.setHeader('Set-Cookie', authCookie(tokenPayload.token, Math.max(0, tokenPayload.expiresAt - Math.floor(Date.now() / 1000))));
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', authCookie('', 0));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'trix-web-api', time: new Date().toISOString() });
});

app.get('/api/db/health', asyncHandler(async (_req, res) => {
  res.json({ ok: await pingDatabase() });
}));

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const username = String(req.body.username ?? '').trim();
  const password = String(req.body.password ?? '');

  if (!email || !email.includes('@')) throw badRequest('请输入有效邮箱');
  if (username.length < 2) throw badRequest('用户名至少需要 2 个字符');
  if (password.length < 6) throw badRequest('密码至少需要 6 位');

  const row = await registerUser({
    id: crypto.randomUUID(),
    email,
    username,
    password,
  });
  const user = publicUser(row);
  const token = createToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ user, session: makeSession(user, token) });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');
  const row = await findUserByEmail(email);
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw unauthorized('邮箱或密码错误，请检查后重试');
  }

  const user = publicUser(row);
  const token = createToken(user);
  setAuthCookie(res, token);
  res.json({ user, session: makeSession(user, token) });
}));

app.post('/api/auth/logout', authenticate, (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/users/:id', authenticate, asyncHandler(async (req, res) => {
  const user = await findUserById(req.params.id);
  if (!user) throw unauthorized('用户不存在');
  res.json({ user: publicUser(user) });
}));

app.get('/api/profile', authenticate, asyncHandler(async (req, res) => {
  const result = await selectRows('profiles', {
    filters: [{ column: 'id', op: 'eq', value: req.user.id }],
    limit: 1,
  });
  res.json({ profile: result.data?.[0] ?? null });
}));

app.patch('/api/profile', authenticate, asyncHandler(async (req, res) => {
  const result = await updateRows('profiles', {
    values: { ...req.body, updated_at: new Date().toISOString() },
    filters: [{ column: 'id', op: 'eq', value: req.user.id }],
  });
  res.json({ profile: result.data?.[0] ?? null });
}));

function userFilter(req) {
  return [{ column: 'user_id', op: 'eq', value: req.user.id }];
}

function idFilter(req) {
  return [
    { column: 'id', op: 'eq', value: req.params.id },
    ...userFilter(req),
  ];
}

function mountUserCrud(basePath, table) {
  app.get(basePath, authenticate, asyncHandler(async (req, res) => {
    const result = await selectRows(table, {
      filters: userFilter(req),
      orders: req.query.order
        ? [{ column: String(req.query.order), ascending: req.query.asc !== 'false' }]
        : undefined,
    });
    res.json({ data: result.data });
  }));

  app.post(basePath, authenticate, asyncHandler(async (req, res) => {
    const result = await insertRows(table, {
      values: { ...req.body, user_id: req.user.id },
    });
    res.status(201).json({ data: result.data?.[0] ?? null });
  }));

  app.patch(`${basePath}/:id`, authenticate, asyncHandler(async (req, res) => {
    const result = await updateRows(table, {
      values: { ...req.body, updated_at: new Date().toISOString() },
      filters: idFilter(req),
    });
    res.json({ data: result.data?.[0] ?? null });
  }));

  app.delete(`${basePath}/:id`, authenticate, asyncHandler(async (req, res) => {
    const result = await deleteRows(table, {
      filters: idFilter(req),
    });
    res.json({ data: result.data });
  }));
}

const PUBLIC_READ_TABLES = new Set([
  'achievements',
  'feature_flags',
  'mall_items',
  'outfits',
  'places',
  'profiles',
  'study_rooms',
  'user_points_overview',
]);

const USER_SCOPED_TABLES = new Set([
  'mails',
  'point_transactions',
  'schedules',
  'study_room_members',
  'study_sessions',
  'todos',
  'user_achievements',
  'user_favorite_places',
  'user_location_settings',
  'user_outfits',
  'user_points',
  'user_purchased_items',
  'user_sessions',
  'user_settings',
]);

function filtersOf(payload) {
  return Array.isArray(payload?.filters) ? payload.filters : [];
}

function addFilter(payload, column, op, value) {
  return {
    ...(payload ?? {}),
    filters: [
      ...filtersOf(payload),
      { column, op, value },
    ],
  };
}

function filterValue(payload, column, op = 'eq') {
  return filtersOf(payload).find((filter) => filter.column === column && filter.op === op)?.value;
}

function hasEqFilter(payload, column, value) {
  return filtersOf(payload).some((filter) => filter.column === column && filter.op === 'eq' && filter.value === value);
}

async function mapRows(payload, mapper) {
  const isArray = Array.isArray(payload?.values);
  const inputRows = isArray ? payload.values : [payload?.values ?? {}];
  const values = await Promise.all(inputRows.map((row) => mapper(row && typeof row === 'object' ? row : {})));
  return {
    ...(payload ?? {}),
    values: isArray ? values : values[0],
  };
}

function stripValueColumns(payload, columns) {
  const blocked = new Set(columns);
  const values = Object.fromEntries(
    Object.entries(payload?.values ?? {}).filter(([column]) => !blocked.has(column)),
  );
  return { ...(payload ?? {}), values };
}

function forceUserColumn(payload, user, column = 'user_id') {
  return mapRows(payload, (row) => ({ ...row, [column]: user.id }));
}

function scopeUserColumn(payload, user, column = 'user_id') {
  return addFilter(payload, column, 'eq', user.id);
}

function conversationIncludesUser(conversationId, userId) {
  return String(conversationId ?? '').split('_').includes(userId);
}

function otherConversationUser(conversationId, userId) {
  return String(conversationId ?? '').split('_').find((part) => part && part !== userId) ?? null;
}

function conversationIdFor(userId, friendId) {
  return userId < friendId ? `${userId}_${friendId}` : `${friendId}_${userId}`;
}

async function getFriendIds(userId) {
  const [rows] = await pool.execute('SELECT friend_id FROM friends WHERE user_id = ?', [userId]);
  return new Set(rows.map((row) => row.friend_id));
}

function extractFriendRequestSenderId(content) {
  const match = String(content ?? '').match(/\[friend_request_from:\]([0-9a-fA-F-]{36})/);
  return match?.[1] ?? null;
}

async function hasIncomingFriendRequest(fromUserId, toUserId) {
  const result = await selectRows('notifications', {
    filters: [
      { column: 'user_id', op: 'eq', value: toUserId },
      { column: 'type', op: 'eq', value: 'friend_request' },
      { column: 'content', op: 'like', value: `%${FRIEND_REQUEST_META_PREFIX}${fromUserId}%` },
    ],
    limit: 1,
  });
  return (result.data?.length ?? 0) > 0;
}

async function applyUserLocationPolicy(action, payload, user) {
  if (action === 'insert' || action === 'upsert') {
    return forceUserColumn(payload, user);
  }
  if (action === 'update' || action === 'delete') {
    return scopeUserColumn(stripValueColumns(payload, ['user_id']), user);
  }

  const ownId = filterValue(payload, 'user_id', 'eq');
  if (ownId === user.id) return payload;

  const requested = filterValue(payload, 'user_id', 'in');
  if (Array.isArray(requested)) {
    const friendIds = await getFriendIds(user.id);
    const allowed = requested.filter((id) => id === user.id || friendIds.has(id));
    return {
      ...(payload ?? {}),
      filters: filtersOf(payload).map((filter) => (
        filter.column === 'user_id' && filter.op === 'in'
          ? { ...filter, value: allowed }
          : filter
      )),
    };
  }

  return scopeUserColumn(payload, user);
}

function applyFriendPolicy(action, payload, user) {
  if (action === 'select') {
    return scopeUserColumn(payload, user);
  }
  if (action === 'insert' || action === 'upsert') {
    return mapRows(payload, (row) => {
      if (row.user_id !== user.id && row.friend_id !== user.id) {
        throw forbidden('好友关系必须包含当前用户');
      }
      return row;
    });
  }
  return scopeUserColumn(stripValueColumns(payload, ['user_id', 'friend_id']), user);
}

function applyFriendRequestPolicy(action, payload, user) {
  if (action === 'insert' || action === 'upsert') {
    return mapRows(payload, (row) => ({ ...row, from_user_id: user.id }));
  }
  if (action === 'select') {
    if (hasEqFilter(payload, 'from_user_id', user.id) || hasEqFilter(payload, 'to_user_id', user.id)) {
      return payload;
    }
    return addFilter(payload, 'to_user_id', 'eq', user.id);
  }
  return addFilter(stripValueColumns(payload, ['from_user_id', 'to_user_id']), 'to_user_id', 'eq', user.id);
}

async function applyNotificationPolicy(action, payload, user) {
  if (action === 'insert' || action === 'upsert') {
    return mapRows(payload, async (row) => {
      const targetUserId = row.user_id;
      if (!targetUserId) throw forbidden('notification user_id required');
      if (targetUserId === user.id) return row;

      if (row.type === 'friend_request') {
        const senderId = extractFriendRequestSenderId(row.content);
        if (senderId !== user.id) {
          throw forbidden('好友请求必须由当前用户发起');
        }
        return row;
      }

      if (row.type === 'system') {
        const [friendRows] = await pool.execute(
          'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ? LIMIT 1',
          [user.id, targetUserId],
        );
        if (friendRows.length > 0) return row;
        if (await hasIncomingFriendRequest(targetUserId, user.id)) return row;
      }

      throw forbidden('无权创建该通知');
    });
  }
  if (action === 'select') {
    const friendRequestLookup = hasEqFilter(payload, 'type', 'friend_request')
      && filtersOf(payload).some((filter) => (
        filter.column === 'content'
        && (filter.op === 'like' || filter.op === 'ilike')
        && String(filter.value ?? '').includes(user.id)
      ));
    if (friendRequestLookup) return payload;
  }
  return scopeUserColumn(stripValueColumns(payload, ['user_id']), user);
}

function applyProfilePolicy(action, payload, user) {
  if (action === 'select') return payload;
  if (action === 'upsert') {
    return mapRows(payload, (row) => {
      const { email: _email, id: _id, ...allowed } = row;
      return { ...allowed, id: user.id };
    });
  }
  if (action === 'update') {
    return addFilter(stripValueColumns(payload, ['id', 'email']), 'id', 'eq', user.id);
  }
  throw forbidden('不能通过通用接口创建或删除用户资料');
}

function applyChatPolicy(action, payload, user) {
  if (action === 'insert') {
    return mapRows(payload, (row) => {
      const receiverId = row.receiver_id ?? otherConversationUser(row.conversation_id, user.id);
      if (!receiverId || receiverId === user.id) throw badRequest('receiver_id required');
      return {
        ...row,
        sender_id: user.id,
        receiver_id: receiverId,
        conversation_id: conversationIdFor(user.id, receiverId),
      };
    });
  }

  const conversationId = filterValue(payload, 'conversation_id', 'eq');
  if (conversationId) {
    if (!conversationIncludesUser(conversationId, user.id)) {
      throw forbidden('无权访问该会话');
    }
    return payload;
  }

  if (hasEqFilter(payload, 'sender_id', user.id) || hasEqFilter(payload, 'receiver_id', user.id)) {
    return payload;
  }

  if (action === 'select') {
    return addFilter(payload, 'sender_id', 'eq', user.id);
  }

  throw forbidden('聊天记录操作必须限定到当前用户会话');
}

function applyUnreadCountPolicy(action, payload, user) {
  if (action === 'insert' || action === 'upsert') {
    return mapRows(payload, (row) => {
      if (row.user_id !== user.id && row.friend_id !== user.id) {
        throw forbidden('未读计数必须关联当前用户');
      }
      return row;
    });
  }
  return scopeUserColumn(stripValueColumns(payload, ['user_id', 'friend_id']), user);
}

function applyCreatedByPolicy(action, payload, user) {
  if (action === 'select') return payload;
  if (action === 'insert' || action === 'upsert') {
    return mapRows(payload, (row) => ({ ...row, created_by: user.id }));
  }
  return addFilter(stripValueColumns(payload, ['created_by']), 'created_by', 'eq', user.id);
}

async function applyTablePolicy(table, action, payload, user) {
  if (table === 'chat_messages') return applyChatPolicy(action, payload, user);
  if (table === 'friends') return applyFriendPolicy(action, payload, user);
  if (table === 'friend_requests') return applyFriendRequestPolicy(action, payload, user);
  if (table === 'notifications') return applyNotificationPolicy(action, payload, user);
  if (table === 'profiles') return applyProfilePolicy(action, payload, user);
  if (table === 'unread_counts') return applyUnreadCountPolicy(action, payload, user);
  if (table === 'user_locations') return applyUserLocationPolicy(action, payload, user);
  if (table === 'friend_latest_messages') {
    if (action !== 'select') throw forbidden('friend_latest_messages is read-only');
    return scopeUserColumn(payload, user);
  }
  if (table === 'study_rooms') return applyCreatedByPolicy(action, payload, user);
  if (PUBLIC_READ_TABLES.has(table)) {
    if (action === 'select') return payload;
    throw forbidden(`${table} is read-only through the Web API`);
  }
  if (USER_SCOPED_TABLES.has(table)) {
    if (action === 'insert' || action === 'upsert') return forceUserColumn(payload, user);
    if (action === 'update' || action === 'delete') return scopeUserColumn(stripValueColumns(payload, ['user_id']), user);
    return scopeUserColumn(payload, user);
  }
  throw forbidden(`No access policy for table: ${table}`);
}

mountUserCrud('/api/todos', 'todos');
mountUserCrud('/api/study/sessions', 'study_sessions');
mountUserCrud('/api/notifications', 'notifications');
mountUserCrud('/api/mails', 'mails');

app.get('/api/study/summary', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [todayResult, totalResult] = await Promise.all([
    pool.execute(
      'SELECT COALESCE(SUM(duration), 0) AS minutes, COUNT(*) AS sessions FROM study_sessions WHERE user_id = ? AND DATE(started_at) = CURRENT_DATE()',
      [userId],
    ),
    pool.execute(
      'SELECT COALESCE(SUM(duration), 0) AS minutes, COUNT(*) AS sessions FROM study_sessions WHERE user_id = ?',
      [userId],
    ),
  ]);
  const [todayRows] = todayResult;
  const [totalRows] = totalResult;
  res.json({
    data: {
      today_minutes: Number(todayRows[0]?.minutes ?? 0),
      today_sessions: Number(todayRows[0]?.sessions ?? 0),
      total_minutes: Number(totalRows[0]?.minutes ?? 0),
      total_sessions: Number(totalRows[0]?.sessions ?? 0),
    },
  });
}));

app.get('/api/friends', authenticate, asyncHandler(async (req, res) => {
  const result = await selectRows('friend_latest_messages', {
    filters: userFilter(req),
    orders: [{ column: 'last_message_time', ascending: false }],
  });
  res.json({ data: result.data });
}));

app.get('/api/friend-requests', authenticate, asyncHandler(async (req, res) => {
  const result = await selectRows('friend_requests', {
    filters: [{ column: 'to_user_id', op: 'eq', value: req.user.id }],
    orders: [{ column: 'created_at', ascending: false }],
  });
  res.json({ data: result.data });
}));

app.get('/api/chat/messages', authenticate, asyncHandler(async (req, res) => {
  const payload = {
    filters: [],
    orders: [{ column: 'created_at', ascending: true }],
  };
  if (req.query.conversation_id) {
    payload.filters.push({ column: 'conversation_id', op: 'eq', value: String(req.query.conversation_id) });
  } else {
    payload.filters.push({ column: 'receiver_id', op: 'eq', value: req.user.id });
  }
  const scopedPayload = await applyTablePolicy('chat_messages', 'select', payload, req.user);
  const result = await selectRows('chat_messages', scopedPayload);
  res.json({ data: result.data });
}));

app.post('/api/chat/messages', authenticate, asyncHandler(async (req, res) => {
  const payload = await applyTablePolicy('chat_messages', 'insert', {
    values: { ...req.body, sender_id: req.body.sender_id ?? req.user.id },
  }, req.user);
  const result = await insertRows('chat_messages', payload);
  res.status(201).json({ data: result.data?.[0] ?? null });
}));

app.get('/api/chat/conversations', authenticate, asyncHandler(async (req, res) => {
  const result = await selectRows('friend_latest_messages', {
    filters: userFilter(req),
    orders: [{ column: 'last_message_time', ascending: false }],
  });
  res.json({ data: result.data });
}));

app.get('/api/points', authenticate, asyncHandler(async (req, res) => {
  const result = await selectRows('user_points', {
    filters: userFilter(req),
    limit: 1,
  });
  res.json({ data: result.data?.[0] ?? null });
}));

app.get('/api/mall/items', authenticate, asyncHandler(async (_req, res) => {
  const result = await selectRows('mall_items', {
    filters: [{ column: 'is_active', op: 'eq', value: true }],
    orders: [{ column: 'display_order', ascending: true }],
  });
  res.json({ data: result.data });
}));

app.get('/api/wardrobe/outfits', authenticate, asyncHandler(async (_req, res) => {
  const result = await selectRows('outfits', {
    filters: [{ column: 'is_active', op: 'eq', value: true }],
    orders: [{ column: 'category', ascending: true }, { column: 'name', ascending: true }],
  });
  res.json({ data: result.data });
}));

app.get('/api/wardrobe/owned', authenticate, asyncHandler(async (req, res) => {
  const result = await selectRows('user_outfits', {
    filters: userFilter(req),
  });
  res.json({ data: result.data });
}));

app.get('/api/places', authenticate, asyncHandler(async (_req, res) => {
  const result = await selectRows('places', {
    filters: [{ column: 'is_active', op: 'eq', value: true }],
  });
  res.json({ data: result.data });
}));

app.get('/api/locations/me', authenticate, asyncHandler(async (req, res) => {
  const result = await selectRows('user_locations', {
    filters: userFilter(req),
    limit: 1,
  });
  res.json({ data: result.data?.[0] ?? null });
}));

app.patch('/api/locations/me', authenticate, asyncHandler(async (req, res) => {
  const result = await insertRows('user_locations', {
    values: { ...req.body, user_id: req.user.id, updated_at: new Date().toISOString() },
    options: { onConflict: 'user_id' },
  }, 'upsert');
  res.json({ data: result.data?.[0] ?? null });
}));

app.post('/api/db/:table/query', authenticate, asyncHandler(async (req, res) => {
  const payload = await applyTablePolicy(req.params.table, 'select', req.body ?? {}, req.user);
  res.json(await selectRows(req.params.table, payload));
}));

app.post('/api/db/:table/insert', authenticate, asyncHandler(async (req, res) => {
  const payload = await applyTablePolicy(req.params.table, 'insert', req.body ?? {}, req.user);
  const status = Array.isArray(req.body?.values) ? 200 : 201;
  res.status(status).json(await insertRows(req.params.table, payload, 'insert'));
}));

app.post('/api/db/:table/upsert', authenticate, asyncHandler(async (req, res) => {
  const payload = await applyTablePolicy(req.params.table, 'upsert', req.body ?? {}, req.user);
  res.json(await insertRows(req.params.table, payload, 'upsert'));
}));

app.patch('/api/db/:table/update', authenticate, asyncHandler(async (req, res) => {
  const payload = await applyTablePolicy(req.params.table, 'update', req.body ?? {}, req.user);
  res.json(await updateRows(req.params.table, payload));
}));

app.post('/api/db/:table/delete', authenticate, asyncHandler(async (req, res) => {
  const payload = await applyTablePolicy(req.params.table, 'delete', req.body ?? {}, req.user);
  res.json(await deleteRows(req.params.table, payload));
}));

app.post('/api/rpc/:name', authenticate, asyncHandler(async (req, res) => {
  const params = req.body ?? {};

  if (req.params.name === 'get_user_points_stats') {
    const userId = req.user.id;
    const [pointsResult, todayResult, weekResult, transactionResult] = await Promise.all([
      pool.execute('SELECT total_points, level FROM user_points WHERE user_id = ? LIMIT 1', [userId]),
      pool.execute('SELECT COALESCE(SUM(points_change), 0) AS total FROM point_transactions WHERE user_id = ? AND points_change > 0 AND DATE(created_at) = CURRENT_DATE()', [userId]),
      pool.execute('SELECT COALESCE(SUM(points_change), 0) AS total FROM point_transactions WHERE user_id = ? AND points_change > 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)', [userId]),
      pool.execute('SELECT COUNT(*) AS total FROM point_transactions WHERE user_id = ?', [userId]),
    ]);
    const [pointsRows] = pointsResult;
    const [todayRows] = todayResult;
    const [weekRows] = weekResult;
    const [transactionRows] = transactionResult;
    return res.json({
      data: [{
        total_points: pointsRows[0]?.total_points ?? 0,
        level: pointsRows[0]?.level ?? 1,
        today_earned: Number(todayRows[0]?.total ?? 0),
        week_earned: Number(weekRows[0]?.total ?? 0),
        total_transactions: Number(transactionRows[0]?.total ?? 0),
      }],
    });
  }

  if (req.params.name === 'add_user_points') {
    const userId = req.user.id;
    const points = Number(params.p_points ?? 0);
    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO user_points (id, user_id, total_points, level, total_earned, total_spent)
         VALUES (?, ?, ?, 1, GREATEST(?, 0), GREATEST(?, 0))
         ON DUPLICATE KEY UPDATE
           total_points = GREATEST(total_points + VALUES(total_points), 0),
           total_earned = total_earned + GREATEST(VALUES(total_points), 0),
           total_spent = total_spent + GREATEST(-VALUES(total_points), 0),
           level = GREATEST(1, FLOOR(GREATEST(total_points + VALUES(total_points), 0) / 100) + 1),
           updated_at = CURRENT_TIMESTAMP`,
        [crypto.randomUUID(), userId, points, points, -points],
      );
      const [rows] = await connection.execute('SELECT total_points FROM user_points WHERE user_id = ? LIMIT 1', [userId]);
      await connection.execute(
        `INSERT INTO point_transactions
          (id, user_id, amount, type, points_change, transaction_type, description, metadata, balance_after)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          userId,
          points,
          points >= 0 ? 'earn' : 'spend',
          points,
          params.p_transaction_type ?? 'admin_adjust',
          params.p_description ?? null,
          params.p_metadata ? JSON.stringify(params.p_metadata) : null,
          rows[0]?.total_points ?? points,
        ],
      );
    });
    return res.json({ data: true });
  }

  if (req.params.name === 'mark_messages_as_read') {
    const userId = req.user.id;
    const friendId = params.p_friend_id;
    if (!friendId) throw badRequest('friend id required');
    const conversationId = userId < friendId ? `${userId}_${friendId}` : `${friendId}_${userId}`;
    await pool.execute(
      'UPDATE chat_messages SET is_read = true WHERE conversation_id = ? AND receiver_id = ?',
      [conversationId, userId],
    );
    await pool.execute(
      'UPDATE unread_counts SET unread_count = 0 WHERE user_id = ? AND friend_id = ?',
      [userId, friendId],
    );
    return res.json({ data: true });
  }

  throw badRequest(`Unsupported RPC: ${req.params.name}`);
}));

app.use((req, res) => {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}` } });
});

app.use((error, _req, res, _next) => {
  const status = error instanceof HttpError ? error.status : error.status || 500;
  const message = error instanceof Error ? error.message : 'Internal server error';
  if (status >= 500) {
    console.error('[trix-web-api]', error);
  }
  res.status(status).json({
    error: {
      message,
      details: error.details,
    },
  });
});

app.listen(port, () => {
  console.log(`TRIX Web API listening on http://localhost:${port}`);
});
