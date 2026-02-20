// 服务器核心功能补丁
// 需要添加到 /opt/clawbot-channel/server.js

// 1. 在文件开头引入消息服务
// const messageService = require('./services/messageService');

// 2. 在 initDatabase() 之后添加：
// messageService.initMessageTable();

// 3. 在 io.on('connection', (socket) => { 内部添加：

/*
// ===== 新增：Bot 响应处理（带消息落库）=====
socket.on('bot_response', async (data) => {
  console.log('[Server] 📩 收到 Bot 响应:', data.response?.substring(0, 50));

  try {
    // 1. 保存到数据库（核心！解决消息黑洞）
    await messageService.saveMessage({
      userId: data.userId,
      deviceId: data.deviceId,
      pairingId: data.pairingId,
      content: data.response,
      contentType: 'text',
      sender: 'bot',
      timestamp: Date.now(),
      messageId: data.messageId || `msg_${Date.now()}`
    });

    console.log('[Server] ✅ Bot 消息已保存到数据库');

    // 2. 转发给 App（如果在线）
    const appSocket = appSockets.get(data.userId);
    if (appSocket && appSocket.connected) {
      appSocket.emit('bot_message', {
        content: data.response,
        contentType: 'text',
        timestamp: Date.now(),
        messageId: data.messageId
      });
      console.log('[Server] ➡️  已转发给 App');
    } else {
      console.log('[Server] ⚠️  App 离线，消息已保存，等待 App 拉取');
    }

  } catch (err) {
    console.error('[Server] Bot 响应处理失败:', err);
  }
});
*/

// 4. 在 app_message 处理中添加消息保存（找到 socket.on('app_message') 后添加）：

/*
// ✅ 保存用户消息到数据库
try {
  await messageService.saveMessage({
    userId: data.userId,
    deviceId: socket.deviceId,
    pairingId: socket.pairingId,
    content: data.content,
    contentType: data.contentType || 'text',
    mediaUrl: data.mediaUrl,
    sender: 'user',
    timestamp: Date.now(),
    messageId: data.messageId
  });
} catch (err) {
  console.error('[Server] 保存用户消息失败:', err);
}
*/

// 5. 在 HTTP API 部分添加消息同步接口：

/*
// ===== 消息同步 API（解决消息黑洞）=====
app.get('/api/messages/sync', async (req, res) => {
  try {
    const { userId, lastTimestamp } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const result = await messageService.fetchMissedMessages(
      userId,
      parseInt(lastTimestamp) || 0
    );

    if (result.success) {
      res.json({
        success: true,
        messages: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch messages'
      });
    }
  } catch (err) {
    console.error('[API] 消息同步失败:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});
*/
