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
    // ✅ P1-#6: 添加唯一约束，防止数据不一致
    db.run("CREATE TABLE IF NOT EXISTS pairings (id TEXT PRIMARY KEY, pairing_code TEXT UNIQUE, pairing_token TEXT UNIQUE, user_id TEXT, device_id TEXT, device_name TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, paired_at DATETIME, expires_at DATETIME, socket_id TEXT, UNIQUE(device_id) WHERE status = 'paired', UNIQUE(user_id) WHERE status = 'paired')");

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

module.exports = {
  db,
  initDatabase,
  dbRun,
  dbGet,
  dbAll
};