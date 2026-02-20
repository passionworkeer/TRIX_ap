// ============================================
// 混合数据库配置（Supabase + SQLite）
// ============================================
// - pairings 表 → Supabase（云端，可靠）
// - messages 表 → SQLite（本地，快速）

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// ============================================
// SQLite 配置（用于本地消息存储）
// ============================================
const dbPath = path.join(__dirname, '..', 'data', 'clawbot.db');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[Database] SQLite connection failed:', err.message);
  } else {
    console.log('[Database] ✅ SQLite connected:', dbPath);
  }
});

// Promise 化的 SQLite 接口
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// ============================================
// Supabase 配置（用于云端配对存储）
// ============================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Database] ⚠️  Supabase 配置缺失，配对功能将不可用');
  console.error('请设置环境变量：SUPABASE_URL 和 SUPABASE_ANON_KEY');
}

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

if (supabase) {
  console.log('[Database] ✅ Supabase connected:', supabaseUrl);
}

// ============================================
// 导出接口
// ============================================
module.exports = {
  // SQLite 接口（用于消息存储）
  dbRun,
  dbGet,
  dbAll,
  db, // 原始 db 对象

  // Supabase 接口（用于配对存储）
  supabase,
};
