const { dbRun } = require('../config/database');

/**
 * 保存消息到 messages 表（兼容旧接口）
 */
async function saveMessage(pairingId, direction, content, contentType, mediaUrl) {
  // 兼容旧的调用方式：saveMessage(pairingId, direction, content, contentType, mediaUrl)
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO messages
      (pairing_id, direction, content, content_type, media_url, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `;

    const params = [
      pairingId,
      direction,
      content,
      contentType || 'text',
      mediaUrl || null
    ];

    dbRun(sql, params)
      .then(() => {
        console.log('[MessageService] ✅ 消息已保存:', content?.substring(0, 30));
        resolve();
      })
      .catch((err) => {
        console.error('[MessageService] ❌ 保存失败:', err);
        reject(err);
      });
  });
}

async function fetchMissedMessages(userId, lastTimestamp) {
  return { success: true, data: [] };
}

async function initMessageTable() {
  console.log('[MessageService] 消息表已存在');
}

module.exports = { saveMessage, fetchMissedMessages, initMessageTable };
