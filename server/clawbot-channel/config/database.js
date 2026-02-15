const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || './data/pairing.db';

// 确保目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to SQLite database');
    // 开启 WAL 模式提升并发性能
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA synchronous = NORMAL');
  }
});

// 初始化表
function initDatabase() {
  db.serialize(() => {
    // 配对关系表
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

    // ✅ P1-#6: 通过部分唯一索引实现一个 Bot 只能配对一个用户
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_device_on_paired
            ON pairings(device_id)
            WHERE status = 'paired'`);

    // ✅ P1-#6: 通过部分唯一索引实现一个用户只能配对一个 Bot
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_on_paired
            ON pairings(user_id)
            WHERE status = 'paired'`);

    // 消息表（临时缓存，定期清理）
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        pairing_id TEXT NOT NULL,
        direction TEXT NOT NULL, -- 'app_to_bot' 或 'bot_to_app'
        content TEXT,
        content_type TEXT DEFAULT 'text',
        media_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered BOOLEAN DEFAULT 0
      )
    `);

    // 创建索引
    db.run('CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairings(pairing_code)');
    db.run('CREATE INDEX IF NOT EXISTS idx_user_id ON pairings(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_device_id ON pairings(device_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_status ON pairings(status)');
  });
}

// Promise 化的数据库辅助函数
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