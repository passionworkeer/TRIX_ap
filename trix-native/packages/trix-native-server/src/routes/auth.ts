// ============================================
// 认证 API 路由
// ============================================

import { Router } from 'express';
import { pairingDB } from '../services/SQLiteStore.js';

const router = Router();

/**
 * POST /api/auth/refresh
 * 刷新 token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'MISSING_REFRESH_TOKEN',
        message: 'refreshToken is required'
      });
      return;
    }

    // 查找匹配的 pairing
    const pairings = pairingDB.findAll() as any[];
    const pairing = pairings.find(p => p.refresh_token === refreshToken);

    if (!pairing) {
      res.status(401).json({
        success: false,
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token'
      });
      return;
    }

    // 生成新的 token
    const { generateToken } = await import('../utils/helpers.js');
    const jwtSecret = process.env.JWT_SECRET || 'default-secret';
    const newPluginToken = generateToken('plugin', jwtSecret, '1y');
    const newRefreshToken = generateToken('refresh', jwtSecret, '30d');

    // 更新 pairing
    pairingDB.update(pairing.code, {
      plugin_token: newPluginToken,
      refresh_token: newRefreshToken
    });

    res.json({
      success: true,
      pluginToken: newPluginToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('[AuthRoutes] Error refreshing token:', error);
    res.status(500).json({
      success: false,
      error: 'REFRESH_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/auth/validate
 * 验证 token 是否有效
 */
router.get('/validate', async (req, res) => {
  try {
    const token = req.headers['x-plugin-token'] as string;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Token is required'
      });
      return;
    }

    // 查找匹配的 pairing
    const pairings = pairingDB.findAll() as any[];
    const valid = pairings.some(p => p.plugin_token === token);

    res.json({ valid });
  } catch (error) {
    console.error('[AuthRoutes] Error validating token:', error);
    res.status(500).json({
      success: false,
      error: 'VALIDATE_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export function createAuthRoutes(): Router {
  return router;
}
