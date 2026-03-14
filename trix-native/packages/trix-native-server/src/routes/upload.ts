// ============================================
// 文件上传API路由
// ============================================

import { Router } from 'express';
import multer from 'multer';
import { StorageService } from '../services/StorageService.js';
import { authenticatePlugin, authenticateAdmin } from '../middleware/auth.js';

const router = Router();

export function createUploadRoutes(storageService: StorageService): Router {
  // 配置 multer
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB
    }
  });

  /**
   * POST /api/upload
   * 上传文件
   * 支持 Plugin 或 Admin 认证
   */
  router.post(
    '/',
    (req, res, next) => {
      // 尝试 Plugin 认证，失败则尝试 Admin
      authenticatePlugin(req, res, (err) => {
        if (err) {
          authenticateAdmin(req, res, next);
        } else {
          next();
        }
      });
    },
    upload.single('file'),
    async (req, res) => {
      try {
        const file = req.file;
        if (!file) {
          res.status(400).json({
            success: false,
            error: 'NO_FILE',
            message: 'No file provided'
          });
          return;
        }

        const { type } = req.body;
        const fileType = type || 'file';

        const result = await storageService.saveFile(file, fileType);

        res.json(result);
      } catch (error) {
        console.error('[UploadRoutes] Error uploading file:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';

        if (message === 'FILE_TOO_LARGE') {
          res.status(400).json({
            success: false,
            error: message,
            message: 'File size exceeds limit (50MB)'
          });
          return;
        }

        if (message === 'UNSUPPORTED_FILE_TYPE') {
          res.status(400).json({
            success: false,
            error: message,
            message: 'File type not allowed'
          });
          return;
        }

        res.status(500).json({
          success: false,
          error: 'UPLOAD_FAILED',
          message
        });
      }
    }
  );

  return router;
}
