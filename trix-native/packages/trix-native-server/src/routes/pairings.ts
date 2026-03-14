// ============================================
// 配对API路由
// ============================================

import { Router } from 'express';
import { PairingService } from '../services/PairingService.js';
import { authenticateAdmin, validatePairingCode } from '../middleware/auth.js';

const router = Router();

export function createPairingRoutes(pairingService: PairingService): Router {
  /**
   * POST /api/pairings
   * 生成新的配对码
   */
  router.post('/', async (req, res) => {
    try {
      const { devicePublicKey, label } = req.body;
      const result = await pairingService.createPairing(devicePublicKey, label);
      res.json(result);
    } catch (error) {
      console.error('[PairingRoutes] Error creating pairing:', error);
      res.status(500).json({
        success: false,
        error: 'CREATE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/pairings/:code
   * 查询配对状态
   */
  router.get('/:code', validatePairingCode, async (req, res) => {
    try {
      const result = await pairingService.getPairingStatus(req.params.code);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message === 'PAIRING_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: message,
          message: '配对码不存在或已过期'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'GET_STATUS_FAILED',
        message
      });
    }
  });

  /**
   * POST /api/pairings/:code/claim
   * 手机认领配对
   */
  router.post('/:code/claim', validatePairingCode, async (req, res) => {
    try {
      const { code } = req.params;
      const { deviceId, deviceName, publicKey } = req.body;

      if (!deviceId || !deviceName) {
        res.status(400).json({
          success: false,
          error: 'MISSING_PARAMS',
          message: 'deviceId and deviceName are required'
        });
        return;
      }

      const result = await pairingService.claimPairing(code, deviceId, deviceName, publicKey);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (['PAIRING_NOT_FOUND', 'PAIRING_EXPIRED', 'PAIRING_ALREADY_USED'].includes(message)) {
        res.status(400).json({
          success: false,
          error: message,
          message: message === 'PAIRING_NOT_FOUND'
            ? '配对码不存在'
            : message === 'PAIRING_EXPIRED'
              ? '配对码已过期'
              : '配对码已被使用'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'CLAIM_FAILED',
        message
      });
    }
  });

  return router;
}
