// ============================================
// 持久化存储服务 - SQLite
// ============================================
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/trix-native.db');
let db = null;
export function initDatabase() {
    if (db) return db;
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.exec(`
    CREATE TABLE IF NOT EXISTS pairings (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      device_public_key TEXT,
      device_id TEXT,
      device_name TEXT,
      plugin_token TEXT,
      refresh_token TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      paired_at TEXT
    );
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'phone',
      status TEXT NOT NULL DEFAULT 'active',
      last_seen TEXT,
      created_at TEXT NOT NULL
    );
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
    CREATE INDEX IF NOT EXISTS idx_pairings_code ON pairings(code);
    CREATE INDEX IF NOT EXISTS idx_pairings_device_id ON pairings(device_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_devices_id ON devices(id);
  `);
    console.log('[Database] Initialized at:', DB_PATH);
    return db;
}
export function getDatabase() {
    if (!db) return initDatabase();
    return db;
}
export function closeDatabase() {
    if (db) { db.close(); db = null; }
}
export const pairingDB = {
    create: (pairing) => {
        const db = getDatabase();
        db.prepare(`INSERT INTO pairings (id, code, status, device_public_key, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(pairing.id, pairing.code, pairing.status, pairing.devicePublicKey || null, pairing.createdAt.toISOString(), pairing.expiresAt.toISOString());
    },
    findByCode: (code) => {
        const db = getDatabase();
        const row = db.prepare('SELECT * FROM pairings WHERE code = ?').get(code.toUpperCase());
        if (!row) return null;
        return {
            id: row.id, code: row.code, status: row.status,
            devicePublicKey: row.device_public_key, deviceId: row.device_id, deviceName: row.device_name,
            pluginToken: row.plugin_token, refreshToken: row.refresh_token,
            createdAt: new Date(row.created_at), expiresAt: new Date(row.expires_at),
            pairedAt: row.paired_at ? new Date(row.paired_at) : undefined
        };
    },
    findByDeviceId: (deviceId) => {
        const db = getDatabase();
        const row = db.prepare('SELECT * FROM pairings WHERE device_id = ?').get(deviceId);
        if (!row) return null;
        return {
            id: row.id, code: row.code, status: row.status,
            deviceId: row.device_id, deviceName: row.device_name,
            pluginToken: row.plugin_token, refreshToken: row.refresh_token,
            createdAt: new Date(row.created_at), expiresAt: new Date(row.expires_at),
            pairedAt: row.paired_at ? new Date(row.paired_at) : undefined
        };
    },
    update: (code, updates) => {
        const db = getDatabase();
        const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = Object.values(updates).map(v => v instanceof Date ? v.toISOString() : v);
        db.prepare(`UPDATE pairings SET ${fields} WHERE code = ?`).run(...values, code.toUpperCase());
    },
    findAll: () => {
        return getDatabase().prepare('SELECT * FROM pairings ORDER BY created_at DESC').all();
    }
};
export const deviceDB = {
    create: (device) => {
        const db = getDatabase();
        db.prepare(`INSERT INTO devices (id, name, type, status, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(device.id, device.name, device.type || 'phone', device.status || 'active',
                 device.lastSeen?.toISOString() || new Date().toISOString(), device.createdAt.toISOString());
    },
    findById: (id) => {
        const row = getDatabase().prepare('SELECT * FROM devices WHERE id = ?').get(id);
        if (!row) return null;
        return { id: row.id, name: row.name, type: row.type, status: row.status,
                 lastSeen: row.last_seen ? new Date(row.last_seen) : null, createdAt: new Date(row.created_at) };
    },
    update: (id, updates) => {
        const db = getDatabase();
        const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = Object.values(updates).map(v => v instanceof Date ? v.toISOString() : v);
        db.prepare(`UPDATE devices SET ${fields} WHERE id = ?`).run(...values, id);
    }
};
export const messageDB = {
    create: (message) => {
        const db = getDatabase();
        db.prepare(`INSERT INTO messages (id, conversation_id, direction, sender_id, sender_name, text, attachments, created_at, delivered) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(message.id, message.conversationId, message.direction,
                 message.senderId || null, message.senderName || null,
                 message.text || null,
                 message.attachments ? JSON.stringify(message.attachments) : null,
                 (message.timestamp instanceof Date ? message.timestamp : new Date()).toISOString(),
                 message.delivered ? 1 : 0);
        return message;
    },
    findByConversation: (conversationId, limit = 50, beforeId) => {
        const db = getDatabase();
        let query = 'SELECT * FROM messages WHERE conversation_id = ?';
        const params = [conversationId];
        if (beforeId) { query += ' AND id < ?'; params.push(beforeId); }
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);
        return db.prepare(query).all(...params).map(row => ({
            id: row.id, conversationId: row.conversation_id, direction: row.direction,
            senderId: row.sender_id, senderName: row.sender_name,
            text: row.text, attachments: row.attachments ? JSON.parse(row.attachments) : [],
            timestamp: new Date(row.created_at), delivered: Boolean(row.delivered)
        }));
    },
    findUndelivered: (conversationId, direction) => {
        return getDatabase().prepare('SELECT * FROM messages WHERE conversation_id = ? AND direction = ? AND delivered = 0 ORDER BY created_at ASC')
            .all(conversationId, direction)
            .map(row => ({
                id: row.id, conversationId: row.conversation_id, direction: row.direction,
                senderId: row.sender_id, senderName: row.sender_name,
                text: row.text, attachments: row.attachments ? JSON.parse(row.attachments) : [],
                timestamp: new Date(row.created_at), delivered: Boolean(row.delivered)
            }));
    },
    markDelivered: (messageId) => {
        getDatabase().prepare('UPDATE messages SET delivered = 1 WHERE id = ?').run(messageId);
    }
};
