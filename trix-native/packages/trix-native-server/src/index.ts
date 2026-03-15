// ============================================
// TRIX Native Server - 主入口
// ============================================

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import { PairingService } from './services/PairingService.js';
import { MessageService } from './services/MessageService.js';
import { StorageService } from './services/StorageService.js';

import { createPairingRoutes } from './routes/pairings.js';
import { createMessageRoutes } from './routes/messages.js';
import { createUploadRoutes } from './routes/upload.js';
import { createDeviceRoutes } from './routes/devices.js';
import { createAuthRoutes } from './routes/auth.js';

import { PhoneWebSocketHandler } from './ws/phone.js';
import { PluginWebSocketHandler } from './ws/plugin.js';
import { AgentWebSocketHandler } from './ws/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  port: parseInt(process.env.PORT || '8788', 10),
  host: process.env.HOST || '0.0.0.0',
  serverUrl: process.env.SERVER_URL || 'http://localhost:8788',
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../attachments'),
  jwtSecret: process.env.JWT_SECRET || 'trix-native-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '365d',
  adminToken: process.env.ADMIN_TOKEN || 'admin-token-change-me',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10)
};

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('          TRIX Native Server v1.0.0');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Server URL: ${CONFIG.serverUrl}`);
  console.log(`Upload Directory: ${CONFIG.uploadDir}`);
  console.log('');

  // 创建 Express 应用
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // 中间件
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 静态文件服务 ( attachments )
  app.use('/attachments', express.static(CONFIG.uploadDir));

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  // 初始化服务
  const pairingService = new PairingService({
    serverUrl: CONFIG.serverUrl,
    jwtSecret: CONFIG.jwtSecret,
    jwtExpiresIn: CONFIG.jwtExpiresIn
  });

  const messageService = new MessageService();
  const storageService = new StorageService(CONFIG.uploadDir, CONFIG.maxFileSize);

  // API 路由
  app.use('/api/pairings', createPairingRoutes(pairingService));
  app.use('/api/messages', createMessageRoutes(messageService));
  app.use('/api/upload', createUploadRoutes(storageService));
  app.use('/api/devices', createDeviceRoutes());
  app.use('/api/auth', createAuthRoutes());

  // WebSocket 处理
  const phoneWsHandler = new PhoneWebSocketHandler(io, pairingService, messageService);
  phoneWsHandler.initialize();

  const pluginWsHandler = new PluginWebSocketHandler(io);
  pluginWsHandler.initialize();

  const agentWsHandler = new AgentWebSocketHandler(io);
  agentWsHandler.initialize();

  // 全局错误处理
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: err.message || 'Internal server error'
    });
  });

  // 启动服务器
  httpServer.listen(CONFIG.port, CONFIG.host as any, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Server running at http://${CONFIG.host}:${CONFIG.port}`);
    console.log('');
    console.log('API Endpoints:');
    console.log(`  POST /api/pairings           - Create pairing code`);
    console.log(`  GET  /api/pairings/:code    - Get pairing status`);
    console.log(`  POST /api/pairings/:code/claim - Claim pairing`);
    console.log(`  POST /api/upload            - Upload file`);
    console.log(`  POST /api/messages/from-plugin - Send to phone`);
    console.log(`  GET  /api/messages/to-plugin   - Get from phone`);
    console.log('');
    console.log('WebSocket:');
    console.log(`  /ws?role=agent&adminToken=XXX - OpenClaw Plugin connection`);
    console.log(`  /ws/phone?code=XXX        - Phone connection`);
    console.log(`  /ws/plugin?token=XXX     - Plugin connection`);
    console.log('═══════════════════════════════════════════════════════');
  });
}

main().catch(console.error);
