import Database from 'better-sqlite3';
import { resolve, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DATA_ROOT = process.env.CANVAS_DATA_DIR ? resolve(process.env.CANVAS_DATA_DIR) : resolve('./data');
if (!existsSync(DATA_ROOT)) {
  mkdirSync(DATA_ROOT, { recursive: true });
}

const dbPath = join(DATA_ROOT, 'canvas.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    script_text TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    session_id TEXT,
    file_id TEXT,
    parent_node_id TEXT,
    scene_id INTEGER,
    media_type TEXT,
    x REAL,
    y REAL,
    prompt TEXT,
    status TEXT,
    aspect TEXT,
    style TEXT,
    task_id TEXT,
    result_url TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_nodes_lookup ON nodes(user_id, project_id);

  CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    edge_type TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
    FOREIGN KEY(target_node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    node_id TEXT,
    filename TEXT,
    stored_filename TEXT,
    mime_type TEXT,
    media_type TEXT,
    prompt TEXT,
    scene_id INTEGER,
    size INTEGER,
    source_url TEXT,
    url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    node_id TEXT,
    parent_node_id TEXT,
    message TEXT,
    media_type TEXT,
    aspect TEXT,
    style TEXT,
    status TEXT,
    task_id TEXT,
    upstream_status TEXT,
    result_urls TEXT, -- JSON array
    messages TEXT,    -- JSON array
    error TEXT,
    last_polled_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );
`);

export default db;
