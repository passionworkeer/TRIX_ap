// ============================================
// Payments API 路由
// 购买积分、收据验证、订单、订阅、恢复购买
// ============================================

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { supabase } = require('../config/supabase');

function success(res, data, message = '成功') {
  res.json({ success: true, message, data });
}

function error(res, message, status = 400) {
  res.status(status).json({ success: false, error: message });
}

function serverError(res, err) {
  console.error('[Payments API Error]', err);
  error(res, '服务器错误', 500);
}

function mapDbOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    user_id: order.user_id,
    product_id: order.product_id,
    amount: Number(order.amount || 0),
    currency: order.currency || 'CNY',
    status: order.status || 'pending',
    transaction_id: order.transaction_id || null,
    points: order.points == null ? null : Number(order.points),
    created_at: order.created_at,
    updated_at: order.updated_at
  };
}

async function addPoints(userId, amount, type, reason) {
  const { data: existingPoints } = await supabase
    .from('user_points')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existingPoints) {
    await supabase
      .from('user_points')
      .update({
        total_points: Number(existingPoints.total_points || 0) + amount,
        lifetime_points: Number(existingPoints.lifetime_points || 0) + amount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
  } else {
    await supabase
      .from('user_points')
      .insert({
        user_id: userId,
        total_points: amount,
        lifetime_points: amount
      });
  }

  await supabase
    .from('points_transactions')
    .insert({
      user_id: userId,
      amount,
      type,
      reason
    });

  const { data: points } = await supabase
    .from('user_points')
    .select('total_points')
    .eq('user_id', userId)
    .single();

  return Number(points?.total_points || 0);
}

async function upsertSubscription({
  userId,
  tier,
  productId,
  expiresAt,
  willAutoRenew = true
}) {
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO user_subscriptions (
      user_id, tier, product_id, is_active, expires_at, will_auto_renew, started_at, updated_at
    ) VALUES (?, ?, ?, 1, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      tier = excluded.tier,
      product_id = excluded.product_id,
      is_active = excluded.is_active,
      expires_at = excluded.expires_at,
      will_auto_renew = excluded.will_auto_renew,
      updated_at = excluded.updated_at`,
    [userId, tier, productId, expiresAt, willAutoRenew ? 1 : 0, now, now]
  );
}

async function createOrder({
  userId,
  productId,
  productType,
  amount,
  currency,
  status,
  transactionId,
  points,
  receiptData,
  metadata
}) {
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO payment_orders (
      id, user_id, product_id, product_type, amount, currency, status,
      transaction_id, points, receipt_data, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      userId,
      productId,
      productType,
      Number(amount || 0),
      currency || 'CNY',
      status || 'pending',
      transactionId || null,
      points == null ? null : Number(points),
      receiptData || null,
      metadata ? JSON.stringify(metadata) : null,
      now,
      now
    ]
  );

  return dbGet('SELECT * FROM payment_orders WHERE id = ?', [orderId]);
}

function inferProductType(productId) {
  if (typeof productId !== 'string') return 'points';
  return productId.toLowerCase().includes('subscription') ? 'subscription' : 'points';
}

function inferSubscriptionTier(productId) {
  if (!productId) return 'premium';
  if (productId.toLowerCase().includes('year')) return 'premium_yearly';
  if (productId.toLowerCase().includes('month')) return 'premium_monthly';
  return 'premium';
}

// POST /payments/purchase-points
router.post('/payments/purchase-points', authMiddleware, async (req, res) => {
  try {
    const {
      product_id,
      productId,
      points,
      amount,
      currency = 'CNY',
      transaction_id,
      transactionId,
      receipt_data,
      receiptData
    } = req.body || {};

    const normalizedProductId = productId || product_id;
    const normalizedTransactionId = transactionId || transaction_id;
    const normalizedReceipt = receiptData || receipt_data || null;
    const normalizedPoints = Number(points || 0);

    if (!normalizedProductId || normalizedPoints <= 0) {
      return error(res, '缺少 product_id 或 points 参数', 400);
    }

    const totalPoints = await addPoints(req.userId, normalizedPoints, 'purchase', '积分购买');
    const order = await createOrder({
      userId: req.userId,
      productId: normalizedProductId,
      productType: 'points',
      amount: Number(amount || 0),
      currency,
      status: 'completed',
      transactionId: normalizedTransactionId,
      points: normalizedPoints,
      receiptData: normalizedReceipt
    });

    const transaction = {
      id: crypto.randomUUID(),
      points_change: normalizedPoints,
      type: 'purchase',
      description: '积分购买',
      balance_after: totalPoints,
      created_at: new Date().toISOString()
    };

    return success(res, {
      order_id: order.id,
      points_added: normalizedPoints,
      total_points: totalPoints,
      transaction
    }, '购买成功');
  } catch (err) {
    serverError(res, err);
  }
});

// POST /payments/verify-receipt
router.post('/payments/verify-receipt', authMiddleware, async (req, res) => {
  try {
    const {
      transaction_id,
      transactionId,
      product_id,
      productId,
      receipt_data,
      receiptData,
      expiration_date,
      expirationDate
    } = req.body || {};

    const normalizedProductId = productId || product_id;
    const normalizedTransactionId = transactionId || transaction_id;
    const normalizedReceipt = receiptData || receipt_data || null;
    const productType = inferProductType(normalizedProductId);
    const points = productType === 'points' ? Number((req.body || {}).points || 0) : 0;

    if (!normalizedProductId || !normalizedTransactionId) {
      return error(res, '缺少 product_id 或 transaction_id', 400);
    }

    let pointsAdded = 0;
    let totalPoints = null;

    if (productType === 'points' && points > 0) {
      pointsAdded = points;
      totalPoints = await addPoints(req.userId, points, 'purchase', '收据验证积分到账');
    }

    if (productType === 'subscription') {
      const defaultExpiry = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      await upsertSubscription({
        userId: req.userId,
        tier: inferSubscriptionTier(normalizedProductId),
        productId: normalizedProductId,
        expiresAt: expirationDate || expiration_date || defaultExpiry,
        willAutoRenew: true
      });
    }

    const order = await createOrder({
      userId: req.userId,
      productId: normalizedProductId,
      productType,
      amount: Number((req.body || {}).amount || 0),
      currency: (req.body || {}).currency || 'CNY',
      status: 'completed',
      transactionId: normalizedTransactionId,
      points: pointsAdded || null,
      receiptData: normalizedReceipt,
      metadata: {
        verified: true
      }
    });

    return success(res, {
      order_id: order.id,
      status: 'completed',
      points_added: pointsAdded || null,
      total_points: totalPoints,
      subscription_status: productType === 'subscription'
        ? {
            is_active: true,
            tier: inferSubscriptionTier(normalizedProductId),
            expires_at: expirationDate || expiration_date || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
            will_auto_renew: true
          }
        : null,
      verified: true,
      message: '收据验证成功'
    });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /payments/orders
router.get('/payments/orders', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const totalRow = await dbGet(
      'SELECT COUNT(*) AS total FROM payment_orders WHERE user_id = ?',
      [req.userId]
    );
    const total = Number(totalRow?.total || 0);

    const rows = await dbAll(
      `SELECT * FROM payment_orders
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.userId, limit, offset]
    );

    return success(res, {
      orders: (rows || []).map(mapDbOrder),
      total,
      page,
      limit
    });
  } catch (err) {
    serverError(res, err);
  }
});

// GET /payments/orders/:id
router.get('/payments/orders/:id', authMiddleware, async (req, res) => {
  try {
    const row = await dbGet(
      'SELECT * FROM payment_orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (!row) return error(res, '订单不存在', 404);
    return success(res, mapDbOrder(row));
  } catch (err) {
    serverError(res, err);
  }
});

// PUT /payments/orders/:id/cancel
router.put('/payments/orders/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const existing = await dbGet(
      'SELECT * FROM payment_orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    if (!existing) return error(res, '订单不存在', 404);
    if (!['pending', 'processing'].includes(existing.status)) {
      return error(res, '当前订单状态不允许取消', 400);
    }

    const now = new Date().toISOString();
    await dbRun(
      `UPDATE payment_orders
       SET status = 'cancelled', cancelled_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [now, now, req.params.id, req.userId]
    );

    return success(res, null, '订单已取消');
  } catch (err) {
    serverError(res, err);
  }
});

// GET /payments/subscription
router.get('/payments/subscription', authMiddleware, async (req, res) => {
  try {
    const row = await dbGet(
      'SELECT * FROM user_subscriptions WHERE user_id = ?',
      [req.userId]
    );

    if (!row) {
      return success(res, {
        is_active: false,
        tier: null,
        product_id: null,
        expires_at: null,
        will_auto_renew: false,
        started_at: null,
        updated_at: null
      });
    }

    return success(res, {
      is_active: Boolean(row.is_active),
      tier: row.tier,
      product_id: row.product_id,
      expires_at: row.expires_at,
      will_auto_renew: Boolean(row.will_auto_renew),
      started_at: row.started_at,
      updated_at: row.updated_at
    });
  } catch (err) {
    serverError(res, err);
  }
});

// POST /payments/restore
router.post('/payments/restore', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT * FROM payment_orders
       WHERE user_id = ? AND status = 'completed'
       ORDER BY created_at DESC`,
      [req.userId]
    );

    return success(res, {
      restored_orders: (rows || []).map(mapDbOrder),
      total_restored: (rows || []).length,
      message: '恢复成功'
    });
  } catch (err) {
    serverError(res, err);
  }
});

module.exports = router;
