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

    // Optional profile fields not present in some Supabase schemas.
    db.run(`
      CREATE TABLE IF NOT EXISTS user_profile_extras (
        user_id TEXT PRIMARY KEY,
        school TEXT,
        grade TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Local unlocked achievements fallback.
    db.run(`
      CREATE TABLE IF NOT EXISTS user_achievements_local (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, achievement_id)
      )
    `);

    // Local purchase history fallback.
    db.run(`
      CREATE TABLE IF NOT EXISTS purchase_history_local (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        points_spent INTEGER NOT NULL DEFAULT 0,
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Local study goals fallback.
    db.run(`
      CREATE TABLE IF NOT EXISTS study_goals_local (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        target_minutes INTEGER NOT NULL DEFAULT 0,
        current_minutes INTEGER NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Local pairing devices fallback.
    db.run(`
      CREATE TABLE IF NOT EXISTS pairing_devices_local (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_name TEXT,
        device_type TEXT DEFAULT 'mobile',
        is_active INTEGER NOT NULL DEFAULT 1,
        paired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Local places and favorites fallback.
    db.run(`
      CREATE TABLE IF NOT EXISTS places_local (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        address TEXT,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS place_favorites_local (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        place_id TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, place_id)
      )
    `);

    // Local user locations fallback.
    db.run(`
      CREATE TABLE IF NOT EXISTS user_locations_local (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        altitude REAL,
        speed REAL,
        heading REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        is_visible INTEGER NOT NULL DEFAULT 1
      )
    `);

    // Local notification device tokens fallback.
    db.run(`
      CREATE TABLE IF NOT EXISTS device_tokens_local (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        platform TEXT,
        app_version TEXT,
        device_model TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Local Clawbot conversation fallback.
    db.run(`
      CREATE TABLE IF NOT EXISTS clawbot_conversations_local (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS clawbot_messages_local (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Local study room fallback.
    db.run(`
      CREATE TABLE IF NOT EXISTS study_rooms_local (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        host_id TEXT NOT NULL,
        max_participants INTEGER NOT NULL DEFAULT 5,
        subject TEXT,
        status TEXT NOT NULL DEFAULT 'waiting',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS study_room_participants_local (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'participant',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(room_id, user_id)
      )
    `);

    // Seed local places once.
    db.run(
      `INSERT OR IGNORE INTO places_local (id, name, description, category, latitude, longitude, address, image_url)
       VALUES
        ('place_sh_library', 'Shanghai Central Library', 'Quiet multi-floor study library', 'library', 31.2307, 121.4705, 'No.1555 Huaihai Middle Road, Shanghai', NULL),
        ('place_xh_cafe', 'Xuhui Study Cafe', 'Cafe with power outlets and stable Wi-Fi', 'cafe', 31.2209, 121.4373, 'Xuhui District, Shanghai', NULL),
        ('place_pudong_hub', 'Pudong Learning Hub', 'Shared study space near metro', 'study_room', 31.2397, 121.4998, 'Pudong New Area, Shanghai', NULL),
        ('place_people_park', 'People''s Park Reading Zone', 'Outdoor reading and review spot', 'park', 31.2315, 121.4680, 'People''s Park, Shanghai', NULL)`
    );

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
    db.run('CREATE INDEX IF NOT EXISTS idx_user_profile_extras_user ON user_profile_extras(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_user_achievements_local_user ON user_achievements_local(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_purchase_history_local_user ON purchase_history_local(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_study_goals_local_user ON study_goals_local(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_pairing_devices_local_user ON pairing_devices_local(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_place_favorites_local_user ON place_favorites_local(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_user_locations_local_user ON user_locations_local(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_device_tokens_local_user ON device_tokens_local(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_clawbot_conversations_local_user ON clawbot_conversations_local(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_clawbot_messages_local_conv ON clawbot_messages_local(conversation_id, created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_study_rooms_local_host ON study_rooms_local(host_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_study_room_participants_local_room ON study_room_participants_local(room_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_study_room_participants_local_user ON study_room_participants_local(user_id)');
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
