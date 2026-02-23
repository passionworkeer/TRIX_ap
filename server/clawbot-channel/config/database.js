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

    // Create indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairings(pairing_code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_user_id ON pairings(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_device_id ON pairings(device_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_status ON pairings(status)');
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
