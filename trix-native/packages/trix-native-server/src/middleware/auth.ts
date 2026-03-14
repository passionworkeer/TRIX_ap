// ============================================
// 认证中间件
// ============================================

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/helpers.js';
import { store } from '../services/MemoryStore.js';

const JWT_SECRET = process.env.JWT_SECRET || 'trix-native-secret-change-in-production';

/**
 * 验证 Plugin Token
 */
export function authenticatePlugin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-plugin-token'] as string;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Missing plugin token'
    });
    return;
  }

  const payload = verifyToken(token, JWT_SECRET);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'TOKEN_EXPIRED',
      message: 'Invalid or expired token'
    });
    return;
  }

  // 验证设备是否存在
  const device = store.devices.get(payload.deviceId as string);
  if (!device || device.status !== 'active') {
    res.status(401).json({
      success: false,
      error: 'DEVICE_NOT_FOUND',
      message: 'Device not found or inactive'
    });
    return;
  }

  // 将用户信息附加到请求
  (req as any).device = device;
  (req as any).tokenPayload = payload;

  next();
}

/**
 * 验证手机 Token (可选，用于未来手机API认证)
 */
export function authenticatePhone(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-phone-token'] as string;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Missing phone token'
    });
    return;
  }

  const payload = verifyToken(token, JWT_SECRET);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: 'TOKEN_EXPIRED',
      message: 'Invalid or expired token'
    });
    return;
  }

  (req as any).phonePayload = payload;
  next();
}

/**
 * 验证 Admin Token (管理API)
 */
export function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adminToken = req.headers['x-trix-admin-token'] as string;

  if (!adminToken) {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Missing admin token'
    });
    return;
  }

  // 简单验证，实际应从配置读取
  const validAdminToken = process.env.ADMIN_TOKEN || 'admin-token-change-me';

  if (adminToken !== validAdminToken) {
    res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Invalid admin token'
    });
    return;
  }

  next();
}

/**
 * 验证配对码
 */
export function validatePairingCode(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const code = req.params.code;

  if (!code || code.length !== 6) {
    res.status(400).json({
      success: false,
      error: 'INVALID_CODE',
      message: 'Invalid pairing code'
    });
    return;
  }

  next();
}
