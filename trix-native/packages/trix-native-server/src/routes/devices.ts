// ============================================
// 设备API路由
// ============================================

import { Router } from 'express';
import { store } from '../services/MemoryStore.js';
import { authenticatePlugin } from '../middleware/auth.js';

const router = Router();

export function createDeviceRoutes(): Router {
  /**
   * GET /api/devices/:deviceId/status
   * 获取设备状态
   * 需要 Plugin 认证
   */
  router.get('/:deviceId/status', authenticatePlugin, (req, res) => {
    try {
      const { deviceId } = req.params;

      const device = store.devices.get(deviceId);

      if (!device) {
        res.status(404).json({
          success: false,
          error: 'DEVICE_NOT_FOUND',
          message: 'Device not found'
        });
        return;
      }

      res.json({
        success: true,
        deviceId: device.id,
        status: device.status,
        lastSeen: device.lastSeen.toISOString()
      });
    } catch (error) {
      console.error('[DeviceRoutes] Error getting status:', error);
      res.status(500).json({
        success: false,
        error: 'STATUS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/devices/:deviceId/heartbeat
   * 设备心跳
   * 需要 Plugin 认证
   */
  router.post('/:deviceId/heartbeat', authenticatePlugin, (req, res) => {
    try {
      const { deviceId } = req.params;

      const device = store.devices.get(deviceId);

      if (!device) {
        res.status(404).json({
          success: false,
          error: 'DEVICE_NOT_FOUND',
          message: 'Device not found'
        });
        return;
      }

      device.lastSeen = new Date();

      res.json({
        success: true,
        lastSeen: device.lastSeen.toISOString()
      });
    } catch (error) {
      console.error('[DeviceRoutes] Error updating heartbeat:', error);
      res.status(500).json({
        success: false,
        error: 'HEARTBEAT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * DELETE /api/devices/:deviceId
   * 删除设备
   * 需要 Admin 认证
   */
  router.delete('/:deviceId', (req, res) => {
    try {
      const { deviceId } = req.params;

      const device = store.devices.get(deviceId);

      if (!device) {
        res.status(404).json({
          success: false,
          error: 'DEVICE_NOT_FOUND',
          message: 'Device not found'
        });
        return;
      }

      device.status = 'inactive';

      res.json({
        success: true,
        message: 'Device deactivated'
      });
    } catch (error) {
      console.error('[DeviceRoutes] Error deleting device:', error);
      res.status(500).json({
        success: false,
        error: 'DELETE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
