const { dbRun, dbGet, dbAll } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class MessageService {
  async ensureColumn(tableName, columnName, definition) {
    const columns = await dbAll(`PRAGMA table_info(${tableName})`);
    const hasColumn = Array.isArray(columns) && columns.some((column) => column.name === columnName);
    if (!hasColumn) {
      await dbRun(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }

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

    await this.ensureColumn('messages', 'media_mime_type', 'TEXT');
    await this.ensureColumn('messages', 'attachment_name', 'TEXT');
    await this.ensureColumn('messages', 'attachment_size', 'INTEGER');
    await this.ensureColumn('messages', 'media_metadata', 'TEXT');

    await dbRun('CREATE INDEX IF NOT EXISTS idx_messages_pairing_id ON messages(pairing_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)');
  }

  async saveMessage(pairingId, direction, content, contentType = 'text', mediaUrl = null, mediaDetails = null) {
    const id = uuidv4();
    const normalizedDetails = mediaDetails && typeof mediaDetails === 'object' ? mediaDetails : {};
    const mediaMimeType = typeof normalizedDetails.mediaMimeType === 'string'
      ? normalizedDetails.mediaMimeType
      : null;
    const attachmentName = typeof normalizedDetails.originalName === 'string'
      ? normalizedDetails.originalName
      : null;
    const attachmentSize = Number.isFinite(Number(normalizedDetails.size))
      ? Number(normalizedDetails.size)
      : null;

    const metadata = { ...normalizedDetails };
    delete metadata.mediaMimeType;
    const serializedMetadata = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;

    // 单条 INSERT 不需要事务
    await dbRun(
      `
        INSERT INTO messages (
          id,
          pairing_id,
          direction,
          content,
          content_type,
          media_url,
          media_mime_type,
          attachment_name,
          attachment_size,
          media_metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        pairingId,
        direction,
        content,
        contentType || 'text',
        mediaUrl || null,
        mediaMimeType,
        attachmentName,
        attachmentSize,
        serializedMetadata,
      ]
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
            m.media_mime_type,
            m.attachment_name,
            m.attachment_size,
            m.media_metadata,
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

      const data = rows.map((row) => {
        let mediaMetadata = null;
        if (typeof row.media_metadata === 'string' && row.media_metadata.trim()) {
          try {
            mediaMetadata = JSON.parse(row.media_metadata);
          } catch {
            mediaMetadata = null;
          }
        }

        return {
          message_id: row.id,
          content: row.content,
          content_type: row.content_type || 'text',
          media_url: row.media_url || null,
          media_mime_type: row.media_mime_type || null,
          attachment_name: row.attachment_name || null,
          attachment_size: row.attachment_size ?? null,
          media_metadata: mediaMetadata,
          timestamp: Date.parse(`${row.created_at}Z`) || Date.now(),
          sender: row.direction === 'bot_to_app' ? 'bot' : 'user'
        };
      });

      return { success: true, data };
    } catch (error) {
      console.error('[MessageService] fetchMissedMessages failed:', error);
      return { success: false, error: error.message, data: [] };
    }
  }
}

module.exports = new MessageService();
