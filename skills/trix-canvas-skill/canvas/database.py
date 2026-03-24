"""SQLite 数据库操作"""
import sqlite3
import os
import json
from pathlib import Path
from contextlib import contextmanager
from typing import Optional

CANVAS_DIR = Path.home() / ".trix-canvas"
CANVAS_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = CANVAS_DIR / "canvas.db"


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_cursor():
    conn = get_db()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                script_text TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                mime_type TEXT DEFAULT '',
                media_type TEXT DEFAULT 'image',
                thumbnail_path TEXT DEFAULT '',
                prompt TEXT DEFAULT '',
                scene_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                file_id INTEGER,
                scene_id INTEGER,
                media_type TEXT DEFAULT 'image',
                x REAL DEFAULT 0,
                y REAL DEFAULT 0,
                prompt TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                task_id TEXT DEFAULT '',
                error_msg TEXT DEFAULT '',
                retry_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS edges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                source_node_id INTEGER NOT NULL,
                target_node_id INTEGER NOT NULL,
                edge_type TEXT DEFAULT 'scene_order',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
                FOREIGN KEY (target_node_id) REFERENCES nodes(id) ON DELETE CASCADE
            )
        """)


# ---------- Projects ----------

def create_project(name: str, script_text: str = "") -> dict:
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO projects (name, script_text) VALUES (?, ?)",
            (name, script_text)
        )
        pid = cur.lastrowid
        cur.execute("SELECT * FROM projects WHERE id = ?", (pid,))
        row = dict(cur.fetchone())
        return row


def list_projects() -> list[dict]:
    with get_cursor() as cur:
        cur.execute("SELECT * FROM projects ORDER BY updated_at DESC")
        return [dict(r) for r in cur.fetchall()]


def get_project(pid: int) -> Optional[dict]:
    with get_cursor() as cur:
        cur.execute("SELECT * FROM projects WHERE id = ?", (pid,))
        row = cur.fetchone()
        return dict(row) if row else None


def delete_project(pid: int) -> bool:
    with get_cursor() as cur:
        cur.execute("DELETE FROM projects WHERE id = ?", (pid,))
        return cur.rowcount > 0


def update_project(pid: int, **fields) -> Optional[dict]:
    if not fields:
        return get_project(pid)
    sets = ", ".join(f"{k} = ?" for k in fields)
    vals = list(fields.values()) + [pid]
    with get_cursor() as cur:
        cur.execute(f"UPDATE projects SET {sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", vals)
        return get_project(pid)


# ---------- Files ----------

def create_file(project_id: int, filename: str, filepath: str,
               mime_type: str = "", media_type: str = "image",
               thumbnail_path: str = "", prompt: str = "",
               scene_id: Optional[int] = None) -> dict:
    with get_cursor() as cur:
        cur.execute(
            """INSERT INTO files (project_id, filename, filepath, mime_type,
               media_type, thumbnail_path, prompt, scene_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (project_id, filename, filepath, mime_type, media_type,
             thumbnail_path, prompt, scene_id)
        )
        fid = cur.lastrowid
        cur.execute("SELECT * FROM files WHERE id = ?", (fid,))
        return dict(cur.fetchone())


def get_file(fid: int) -> Optional[dict]:
    with get_cursor() as cur:
        cur.execute("SELECT * FROM files WHERE id = ?", (fid,))
        row = cur.fetchone()
        return dict(row) if row else None


def update_file(fid: int, **fields) -> Optional[dict]:
    if not fields:
        return get_file(fid)
    sets = ", ".join(f"{k} = ?" for k in fields)
    vals = list(fields.values()) + [fid]
    with get_cursor() as cur:
        cur.execute(f"UPDATE files SET {sets} WHERE id = ?", vals)
        return get_file(fid)


def delete_file(fid: int) -> bool:
    with get_cursor() as cur:
        cur.execute("DELETE FROM files WHERE id = ?", (fid,))
        return cur.rowcount > 0


def list_project_files(project_id: int) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM files WHERE project_id = ? ORDER BY scene_id, id",
            (project_id,)
        )
        return [dict(r) for r in cur.fetchall()]


# ---------- Nodes ----------

def create_node(project_id: int, file_id: Optional[int] = None,
                scene_id: Optional[int] = None, media_type: str = "image",
                x: float = 0, y: float = 0, prompt: str = "",
                status: str = "pending", task_id: str = "",
                error_msg: str = "") -> dict:
    with get_cursor() as cur:
        cur.execute(
            """INSERT INTO nodes (project_id, file_id, scene_id, media_type,
               x, y, prompt, status, task_id, error_msg)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (project_id, file_id, scene_id, media_type,
             x, y, prompt, status, task_id, error_msg)
        )
        nid = cur.lastrowid
        cur.execute("SELECT * FROM nodes WHERE id = ?", (nid,))
        return dict(cur.fetchone())


def get_node(nid: int) -> Optional[dict]:
    with get_cursor() as cur:
        cur.execute("SELECT * FROM nodes WHERE id = ?", (nid,))
        row = cur.fetchone()
        return dict(row) if row else None


def update_node(nid: int, **fields) -> Optional[dict]:
    if not fields:
        return get_node(nid)
    sets = ", ".join(f"{k} = ?" for k in fields)
    vals = list(fields.values()) + [nid]
    with get_cursor() as cur:
        cur.execute(f"UPDATE nodes SET {sets} WHERE id = ?", vals)
        return get_node(nid)


def delete_node(nid: int) -> bool:
    with get_cursor() as cur:
        # 删除关联边
        cur.execute(
            "DELETE FROM edges WHERE source_node_id = ? OR target_node_id = ?",
            (nid, nid)
        )
        cur.execute("DELETE FROM nodes WHERE id = ?", (nid,))
        return cur.rowcount > 0


def list_project_nodes(project_id: int) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM nodes WHERE project_id = ? ORDER BY scene_id, id",
            (project_id,)
        )
        return [dict(r) for r in cur.fetchall()]


# ---------- Edges ----------

def create_edge(project_id: int, source_node_id: int, target_node_id: int,
               edge_type: str = "scene_order") -> dict:
    with get_cursor() as cur:
        cur.execute(
            """INSERT INTO edges (project_id, source_node_id, target_node_id, edge_type)
               VALUES (?, ?, ?, ?)""",
            (project_id, source_node_id, target_node_id, edge_type)
        )
        eid = cur.lastrowid
        cur.execute("SELECT * FROM edges WHERE id = ?", (eid,))
        return dict(cur.fetchone())


def delete_edge(eid: int) -> bool:
    with get_cursor() as cur:
        cur.execute("DELETE FROM edges WHERE id = ?", (eid,))
        return cur.rowcount > 0


def list_project_edges(project_id: int) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM edges WHERE project_id = ? ORDER BY id",
            (project_id,)
        )
        return [dict(r) for r in cur.fetchall()]


# ---------- Init ----------

init_db()
