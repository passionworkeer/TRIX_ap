const { dbRun, dbGet, dbAll } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class MessageService {
  async initMessageTable() {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        pairing_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        content TEXT,
        content_type TEXT DEFAULT 'text',
        media_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered BOOLEAN DEFAULT 0
      )
    `);

    await dbRun('CREATE INDEX IF NOT EXISTS idx_messages_pairing_id ON messages(pairing_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)');
  }

  async saveMessage(pairingId, direction, content, contentType = 'text', mediaUrl = null) {
    const id = uuidv4();
    await dbRun(
      `
        INSERT INTO messages (id, pairing_id, direction, content, content_type, media_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [id, pairingId, direction, content, contentType || 'text', mediaUrl || null]
    );
    return id;
  }

  async markDelivered(messageId) {
    await dbRun('UPDATE messages SET delivered = 1 WHERE id = ?', [messageId]);
  }

  async getUndeliveredMessages(pairingId, direction) {
    return dbAll(
      `
        SELECT *
        FROM messages
        WHERE pairing_id = ? AND direction = ? AND delivered = 0
        ORDER BY created_at ASC
      `,
      [pairingId, direction]
    );
  }

  async cleanupOldMessages(days = 7) {
    const safeDays = Number.isFinite(Number(days)) && Number(days) > 0 ? Number(days) : 7;
    await dbRun(
      `
        DELETE FROM messages
        WHERE created_at < datetime('now', ?)
      `,
      [`-${safeDays} days`]
    );
  }

  async fetchMissedMessages(userId, lastTimestamp = 0, limit = 200) {
    try {
      const safeLast = Number.isFinite(Number(lastTimestamp)) && Number(lastTimestamp) > 0
        ? Number(lastTimestamp)
        : 0;
      const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0
        ? Math.min(Number(limit), 500)
        : 200;

      const lastSqlTime = new Date(safeLast).toISOString().slice(0, 19).replace('T', ' ');

      const rows = await dbAll(
        `
          SELECT
            m.id,
            m.direction,
            m.content,
            m.content_type,
            m.media_url,
            m.created_at
          FROM messages m
          INNER JOIN pairings p ON p.id = m.pairing_id
          WHERE p.user_id = ?
            AND p.status = 'paired'
            AND m.direction IN ('bot_to_app', 'app_to_bot')
            AND m.created_at > ?
          ORDER BY m.created_at ASC
          LIMIT ?
        `,
        [userId, lastSqlTime, safeLimit]
      );

      const data = rows.map((row) => ({
        message_id: row.id,
        content: row.content,
        content_type: row.content_type || 'text',
        media_url: row.media_url || null,
        timestamp: Date.parse(`${row.created_at}Z`) || Date.now(),
        sender: row.direction === 'bot_to_app' ? 'bot' : 'user'
      }));

      return { success: true, data };
    } catch (error) {
      console.error('[MessageService] fetchMissedMessages failed:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
}

module.exports = new MessageService();
