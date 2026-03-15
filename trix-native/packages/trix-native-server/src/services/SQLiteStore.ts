// ============================================
// 持久化存储服务 - SQLite
// ============================================

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/trix-native.db');

let db: Database.Database | null = null;

/**
 * 初始化数据库
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  // 确保目录存在
  const dbDir = path.dirname(DB_PATH);
  const fs = require('fs');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(DB_PATH);

  // 创建表
  db.exec(`
    -- 配对表
    CREATE TABLE IF NOT EXISTS pairings (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      device_public_key TEXT,
      device_id TEXT,
      device_name TEXT,
      device_public_key TEXT,
      plugin_token TEXT,
      refresh_token TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      paired_at TEXT
    );

    -- 设备表
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'phone',
      status TEXT NOT NULL DEFAULT 'active',
      last_seen TEXT,
      created_at TEXT NOT NULL
    );

    -- 消息表
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      sender_id TEXT,
      sender_name TEXT,
      text TEXT,
      attachments TEXT,
      created_at TEXT NOT NULL,
      delivered INTEGER DEFAULT 0
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_pairings_code ON pairings(code);
    CREATE INDEX IF NOT EXISTS idx_pairings_device_id ON pairings(device_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_devices_id ON devices(id);
  `);

  console.log('[Database] Initialized at:', DB_PATH);
  return db;
}

/**
 * 获取数据库实例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * 关闭数据库
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[Database] Closed');
  }
}

// 配对操作
export const pairingDB = {
  create: (pairing: any) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO pairings (id, code, status, device_public_key, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      pairing.id,
      pairing.code,
      pairing.status,
      pairing.devicePublicKey || null,
      pairing.createdAt.toISOString(),
      pairing.expiresAt.toISOString()
    );
  },

  findByCode: (code: string): any => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM pairings WHERE code = ?');
    const row = stmt.get(code.toUpperCase()) as any;
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      devicePublicKey: row.device_public_key,
      deviceId: row.device_id,
      deviceName: row.device_name,
      pluginToken: row.plugin_token,
      refreshToken: row.refresh_token,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      pairedAt: row.paired_at ? new Date(row.paired_at) : undefined
    };
  },

  findByDeviceId: (deviceId: string): any => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM pairings WHERE device_id = ?');
    const row = stmt.get(deviceId) as any;
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      status: row.status,
      deviceId: row.device_id,
      deviceName: row.device_name,
      pluginToken: row.plugin_token,
      refreshToken: row.refresh_token,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      pairedAt: row.paired_at ? new Date(row.paired_at) : undefined
    };
  },

  update: (code: string, updates: any) => {
    const db = getDatabase();
    const fields = Object.keys(updates)
      .map(k => `${k} = ?`)
      .join(', ');
    const values = Object.values(updates).map(v => {
      if (v instanceof Date) return v.toISOString();
      return v;
    });

    const stmt = db.prepare(`UPDATE pairings SET ${fields} WHERE code = ?`);
    stmt.run(...values, code.toUpperCase());
  },

  delete: (code: string) => {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM pairings WHERE code = ?');
    stmt.run(code.toUpperCase());
  },

  findAll: () => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM pairings ORDER BY created_at DESC');
    return stmt.all();
  }
};

// 设备操作
export const deviceDB = {
  create: (device: any) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO devices (id, name, type, status, last_seen, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      device.id,
      device.name,
      device.type || 'phone',
      device.status || 'active',
      device.lastSeen?.toISOString() || new Date().toISOString(),
      device.createdAt.toISOString()
    );
  },

  findById: (id: string) => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM devices WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      status: row.status,
      lastSeen: row.last_seen ? new Date(row.last_seen) : null,
      createdAt: new Date(row.created_at)
    };
  },

  update: (id: string, updates: any) => {
    const db = getDatabase();
    const fields = Object.keys(updates)
      .map(k => `${k} = ?`)
      .join(', ');
    const values = Object.values(updates).map(v => {
      if (v instanceof Date) return v.toISOString();
      return v;
    });

    const stmt = db.prepare(`UPDATE devices SET ${fields} WHERE id = ?`);
    stmt.run(...values, id);
  },

  findAll: () => {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM devices ORDER BY created_at DESC');
    return stmt.all();
  }
};

// 消息操作
export const messageDB = {
  create: (message: any) => {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO messages (id, conversation_id, direction, sender_id, sender_name, text, attachments, created_at, delivered)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      message.id,
      message.conversationId,
      message.from,
      message.senderId,
      message.senderName || null,
      message.text || null,
      message.attachments ? JSON.stringify(message.attachments) : null,
      message.timestamp instanceof Date ? message.timestamp.toISOString() : new Date(message.timestamp).toISOString(),
      message.delivered ? 1 : 0
    );
  },

  findByConversation: (conversationId: string, limit = 50, beforeId?: string) => {
    const db = getDatabase();
    let query = 'SELECT * FROM messages WHERE conversation_id = ?';
    const params: any[] = [conversationId];

    if (beforeId) {
      const beforeMsg = db.prepare('SELECT created_at FROM messages WHERE id = ?').get(beforeId) as any;
      if (beforeMsg) {
        query += ' AND created_at < ?';
        params.push(beforeMsg.created_at);
      }
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.reverse().map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      from: row.direction,
      senderId: row.sender_id,
      senderName: row.sender_name,
      text: row.text,
      attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
      timestamp: new Date(row.created_at),
      delivered: row.delivered === 1
    }));
  },

  findUndelivered: (conversationId: string, direction: string): any[] => {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ? AND direction = ? AND delivered = 0
      ORDER BY created_at ASC
    `);
    return stmt.all(conversationId, direction);
  },

  markDelivered: (id: string) => {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE messages SET delivered = 1 WHERE id = ?');
    stmt.run(id);
  }
};
