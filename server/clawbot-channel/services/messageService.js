const { dbRun, dbGet, dbAll } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class MessageService {
  // 保存消息
  async saveMessage(pairingId, direction, content, contentType = 'text', mediaUrl = null) {
    const id = uuidv4();
    await dbRun(`
      INSERT INTO messages (id, pairing_id, direction, content, content_type, media_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, pairingId, direction, content, contentType, mediaUrl]);
    return id;
  }

  // 标记消息已送达
  async markDelivered(messageId) {
    await dbRun('UPDATE messages SET delivered = 1 WHERE id = ?', [messageId]);
  }

  // 获取未送达消息
  async getUndeliveredMessages(pairingId, direction) {
    return await dbAll(`
      SELECT * FROM messages
      WHERE pairing_id = ? AND direction = ? AND delivered = 0
      ORDER BY created_at ASC
    `, [pairingId, direction]);
  }

  // 清理旧消息（保留最近7天）
  async cleanupOldMessages() {
    await dbRun(`
      DELETE FROM messages
      WHERE created_at < datetime('now', '-7 days')
    `);
  }
}

module.exports = new MessageService();
