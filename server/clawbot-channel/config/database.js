const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || './data/clawbot.db';

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to SQLite database');
    // Enable WAL mode to improve concurrent performance
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
  }
});

// Initialize database tables
function initDatabase() {
  db.serialize(() => {
    // Pairing relationship table
    db.run(`CREATE TABLE IF NOT EXISTS pairings (
      id TEXT PRIMARY KEY,
      pairing_code TEXT UNIQUE,
      pairing_token TEXT UNIQUE,
      user_id TEXT,
      device_id TEXT,
      device_name TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paired_at DATETIME,
      expires_at DATETIME,
      socket_id TEXT
    )`);

    // P1-#6: Ensure one device can only pair with one user via partial unique index
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_device_on_paired
            ON pairings(device_id)
            WHERE status = 'paired'`);

    // P1-#6: Ensure one user can only pair with one device via partial unique index
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_on_paired
            ON pairings(user_id)
            WHERE status = 'paired'`);

    // Messages table (temporary cache, periodically cleaned)
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        pairing_id TEXT NOT NULL,
        direction TEXT NOT NULL, -- 'app_to_bot' or 'bot_to_app'
        content TEXT,
        content_type TEXT DEFAULT 'text',
        media_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered BOOLEAN DEFAULT 0
      )
    `);

    // Payment orders table
    db.run(`
      CREATE TABLE IF NOT EXISTS payment_orders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_type TEXT NOT NULL DEFAULT 'points',
        amount REAL DEFAULT 0,
        currency TEXT DEFAULT 'CNY',
        status TEXT NOT NULL DEFAULT 'pending',
        transaction_id TEXT,
        points INTEGER,
        receipt_data TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        cancelled_at DATETIME
      )
    `);

    // User subscription table
    db.run(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        user_id TEXT PRIMARY KEY,
        tier TEXT,
        product_id TEXT,
        is_active INTEGER DEFAULT 0,
        expires_at DATETIME,
        will_auto_renew INTEGER DEFAULT 0,
        started_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Linked OAuth accounts table
    db.run(`
      CREATE TABLE IF NOT EXISTS oauth_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        email TEXT,
        display_name TEXT,
        avatar_url TEXT,
        access_token TEXT,
        refresh_token TEXT,
        expires_at DATETIME,
        is_primary INTEGER DEFAULT 0,
        linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, provider),
        UNIQUE(provider, provider_user_id)
      )
    `);

    // Per-user chat room preferences (mute/archive)
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_room_user_preferences (
        user_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        is_muted INTEGER DEFAULT 0,
        is_archived INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, room_id)
      )
    `);

    // Local chat room tables (fallback when Supabase chat tables are unavailable)
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_rooms_local (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'group',
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS chat_room_participants_local (
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_read_at DATETIME,
        PRIMARY KEY (room_id, user_id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS chat_messages_local (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT,
        content_type TEXT DEFAULT 'text',
        media_url TEXT,
        media_mime_type TEXT,
        media_duration INTEGER,
        reply_to_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairings(pairing_code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_user_id ON pairings(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_device_id ON pairings(device_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_status ON pairings(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payment_orders_transaction_id ON payment_orders(transaction_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider)');
    db.run('CREATE INDEX IF NOT EXISTS idx_chat_room_preferences_user_room ON chat_room_user_preferences(user_id, room_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_chat_rooms_local_updated_at ON chat_rooms_local(updated_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_chat_room_participants_local_user ON chat_room_participants_local(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_chat_messages_local_room_created ON chat_messages_local(room_id, created_at)');
  });
}

// Promise wrapper for database operations
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initDatabase,
  dbRun,
  dbGet,
  dbAll
};
