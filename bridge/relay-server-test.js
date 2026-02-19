// relay-server-test.js
// 简化版本地测试 Relay Server（用于测试 Bridge 集成）

const socketIO = require('socket.io');

// Socket.IO 服务器
const io = socketIO(8765, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Bridge 和 App 连接管理
const bridges = new Map();
const apps = new Map();

console.log(`
╔═══════════════════════════════════════════════════════╗
║   Local Test Relay Server (Bridge Mode)              ║
╠═══════════════════════════════════════════════════════╣
║  Port:         8765                                  ║
║  Mode:         Bridge + App                          ║
║  Status:       Running                               ║
╚═══════════════════════════════════════════════════════╝
`);

io.on('connection', (socket) => {
  console.log(`[Relay Server] 客户端连接: ${socket.id}`);

  // ==================== Bridge 注册 ====================

  socket.on('bridge_register', (data) => {
    const { type, version } = data;

    if (type === 'openclaw') {
      socket.deviceType = 'openclaw_bridge';
      socket.bridgeVersion = version;

      bridges.set(socket.id, {
        type: type,
        version: version,
        socket: socket,
        connectedAt: new Date().toISOString()
      });

      console.log(`[Relay Server] ✅ OpenClaw Bridge 注册成功 (v${version})`);
      console.log(`[Relay Server] 当前 Bridge 数量: ${bridges.size}`);

      socket.emit('bridge_registered', {
        success: true,
        message: 'Bridge 注册成功'
      });
    }
  });

  // ==================== App 注册 ====================

  socket.on('app_register', (data) => {
    const { userId } = data;

    socket.deviceType = 'mobile_app';
    socket.userId = userId;

    apps.set(socket.id, {
      userId: userId,
      socket: socket,
      connectedAt: new Date().toISOString()
    });

    console.log(`[Relay Server] ✅ App 注册成功 (用户: ${userId})`);
    console.log(`[Relay Server] 当前 App 数量: ${apps.size}`);

    socket.emit('app_registered', {
      success: true,
      message: 'App 注册成功'
    });
  });

  // ==================== 消息处理（核心逻辑）====================

  // App 发送消息
  socket.on('app_message', async (data) => {
    const { content, messageId, userId } = data;

    console.log(`[Relay Server] 📨 收到 App 消息: ${content.substring(0, 50)}...`);

    // 查找可用的 OpenClaw Bridge
    const openclawBridge = findOpenClawBridge();

    if (!openclawBridge) {
      console.log('[Relay Server] ⚠️ 未找到可用的 OpenClaw Bridge');

      socket.emit('bot_message', {
        content: 'AI 助手离线。请确保本地电脑运行着 openclaw-bridge.js',
        contentType: 'text',
        timestamp: Date.now(),
        error: true,
        messageId: messageId
      });
      return;
    }

    // 转发消息到本地 Bridge
    console.log(`[Relay Server] 📤 转发消息到 OpenClaw Bridge...`);
    openclawBridge.socket.emit('app_message', data);
  });

  // Bridge 返回 AI 响应
  socket.on('bot_message', (data) => {
    const { content, messageId } = data;

    console.log(`[Relay Server] 📨 收到 Bridge 响应: ${content.substring(0, 50)}...`);

    // 转发给所有 App
    apps.forEach((app, socketId) => {
      app.socket.emit('bot_message', data);
      console.log(`[Relay Server] 📤 转发响应到 App: ${app.userId}`);
    });
  });

  // 消息确认
  socket.on('message_sent', (data) => {
    console.log(`[Relay Server] ✅ 消息已处理: ${data.messageId}`);
  });

  // 心跳
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // 断开连接
  socket.on('disconnect', () => {
    console.log('[Relay Server] 客户端断开:', socket.id);

    if (socket.deviceType === 'openclaw_bridge') {
      bridges.delete(socket.id);
      console.log(`[Relay Server] Bridge 断开，剩余: ${bridges.size}`);
    } else if (socket.deviceType === 'mobile_app') {
      apps.delete(socket.id);
      console.log(`[Relay Server] App 断开，剩余: ${apps.size}`);
    }
  });

  // ==================== 辅助函数 ====================

  function findOpenClawBridge() {
    // 返回第一个可用的 Bridge
    for (const [id, bridge] of bridges) {
      return bridge;
    }
    return null;
  }
});

// 启动服务器
const PORT = 8765;
console.log(`[Relay Server] ✅ Socket.IO 服务器启动: ws://localhost:${PORT}`);
