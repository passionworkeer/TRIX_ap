// ============================================
// TRIX Native Server - 主入口
// ============================================
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { PairingService } from './services/PairingService.js';
import { MessageService } from './services/MessageService.js';
import { StorageService } from './services/StorageService.js';
import { initDatabase } from './services/SQLiteStore.js';
import { createPairingRoutes } from './routes/pairings.js';
import { createMessageRoutes } from './routes/messages.js';
import { createUploadRoutes } from './routes/upload.js';
import { createDeviceRoutes } from './routes/devices.js';
import { createAuthRoutes } from './routes/auth.js';
import { PhoneWebSocketHandler } from './ws/phone.js';
import { PluginWebSocketHandler } from './ws/plugin.js';
import { AgentWebSocketHandler } from './ws/agent.js';
import { createNativeAgentWebSocketServer, broadcastToAgent } from './ws/ws-native-agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
    port: parseInt(process.env.PORT || '8788', 10),
    host: process.env.HOST || '0.0.0.0',
    serverUrl: process.env.SERVER_URL || `http://localhost:${parseInt(process.env.PORT || '8788', 10)}`,
    uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../attachments'),
    adminToken: process.env.ADMIN_TOKEN || 'admin-token-change-me',
    serviceToken: process.env.SERVICE_TOKEN || '',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10),
};

// 从 state.json 加载或生成 serviceToken
function loadOrCreateServiceToken() {
    const configDir = path.join(__dirname, '../../.trix-native-channel');
    const statePath = path.join(configDir, 'state.json');
    let state = {};
    if (fs.existsSync(statePath)) {
        try {
            state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        } catch (e) { /* ignore */ }
    }
    if (!state.serviceToken) {
        state.serviceToken = crypto.randomBytes(24).toString('hex');
        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
        console.log('[Config] Generated new serviceToken');
    }
    return state.serviceToken;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('          TRIX Native Server v1.1.0');
    console.log('═══════════════════════════════════════════════════════');

    // 生成 serviceToken
    const serviceToken = loadOrCreateServiceToken();
    CONFIG.serviceToken = serviceToken;
    console.log(`Server URL: ${CONFIG.serverUrl}`);
    console.log(`Upload Directory: ${CONFIG.uploadDir}`);
    console.log(`ServiceToken: ${serviceToken.slice(0, 8)}... (${serviceToken.length} chars)`);
    console.log('');

    // 初始化数据库
    initDatabase();

    // 创建 Express 应用
    const app = express();
    const httpServer = createServer(app);

    // 配置 Socket.IO (CORS)
    const io = new Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        path: '/socket.io',
    });

    // 中间件
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // 静态文件
    app.use('/attachments', express.static(CONFIG.uploadDir));

    // 健康检查
    app.get('/health', (req, res) => {
        res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
    });

    // 初始化服务
    const pairingService = new PairingService({ serverUrl: CONFIG.serverUrl });
    const messageService = new MessageService();
    const storageService = new StorageService(CONFIG.uploadDir, CONFIG.maxFileSize);

    // API 路由
    app.use('/api/pairings', createPairingRoutes(pairingService));
    app.use('/api/messages', createMessageRoutes(messageService));
    app.use('/api/upload', createUploadRoutes(storageService));
    app.use('/api/devices', createDeviceRoutes());
    app.use('/api/auth', createAuthRoutes());

    // WebSocket 处理 - Socket.IO
    const phoneWsHandler = new PhoneWebSocketHandler(io, pairingService, messageService);
    phoneWsHandler.initialize();

    const pluginWsHandler = new PluginWebSocketHandler(io);
    pluginWsHandler.initialize();

    const agentWsHandler = new AgentWebSocketHandler(io);
    agentWsHandler.initialize();

    // Native WebSocket for OpenClaw Plugin (ws package, not Socket.IO)
    // Intercepts /ws?role=agent upgrades
    createNativeAgentWebSocketServer(httpServer, serviceToken, CONFIG.adminToken);

    // 全局错误处理
    app.use((err, req, res, next) => {
        console.error('[Server] Unhandled error:', err);
        res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message || 'Internal server error' });
    });

    // 启动服务器
    httpServer.listen(CONFIG.port, CONFIG.host, () => {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Server running at http://${CONFIG.host}:${CONFIG.port}`);
        console.log('');
        console.log('API Endpoints:');
        console.log(`  POST /api/pairings           - Create pairing code`);
        console.log(`  GET  /api/pairings/:code     - Get pairing status`);
        console.log(`  POST /api/pairings/:code/claim - Claim pairing`);
        console.log(`  POST /api/messages           - Phone sends message`);
        console.log(`  GET  /api/messages/:convId  - Get message history`);
        console.log(`  POST /api/messages/service/messages - Plugin sends to phone`);
        console.log(`  POST /api/upload             - Upload file`);
        console.log('');
        console.log('WebSocket (Native ws):');
        console.log(`  /ws?role=agent&serviceToken=XXX - OpenClaw Plugin (native ws)`);
        console.log('');
        console.log('WebSocket (Socket.IO):');
        console.log(`  /socket.io/  - Phone & Plugin connections`);
        console.log('═══════════════════════════════════════════════════════');
    });
}

main().catch(console.error);
