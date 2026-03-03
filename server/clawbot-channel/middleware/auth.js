// ============================================
// JWT 认证中间件
// ============================================

const { supabase } = require('../config/supabase');

/**
 * 验证 JWT Token 并获取用户信息
 */
async function authMiddleware(req, res, next) {
  try {
    // 从 header 获取 token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.substring(7);

    // 验证 token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: '无效或已过期的令牌' });
    }

    // 将用户信息添加到请求对象
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    console.error('[Auth] 认证中间件错误:', error);
    return res.status(500).json({ error: '认证失败' });
  }
}

/**
 * 可选的认证中间件 - 如果有 token 则验证，没有则继续
 */
async function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      req.userId = null;
      return next();
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      req.user = null;
      req.userId = null;
    } else {
      req.user = user;
      req.userId = user.id;
    }

    next();
  } catch (error) {
    req.user = null;
    req.userId = null;
    next();
  }
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
};
