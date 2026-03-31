"""TRIX Canvas Skill — 公共模块：配置、HTTP 工具、Canvas API 封装"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlencode, urlparse

from _paths import default_canvas_data_dir

# ---------- 配置 ----------
CANVAS_BASE = os.environ.get("CANVAS_BASE_URL", "http://localhost:8789").rstrip("/")
AI_API_BASE = os.environ.get("AI_API_BASE", "")
AI_API_KEY = os.environ.get("AI_API_KEY", "")

CANVAS_LOCAL_DIR = Path(
    os.environ.get("CANVAS_DATA_DIR", str(default_canvas_data_dir()))
).resolve()

SAFE_EXTS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".mp4",
    ".mov",
    ".avi",
    ".mkv",
    ".srt",
    ".md",
    ".txt",
}
MAX_DOWNLOAD_SIZE = 500 * 1024 * 1024  # 500 MB，上限防护
_DIRECT_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def _canvas_headers() -> dict:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _request_json(method: str, path: str, body: dict | None = None, params: dict | None = None) -> dict:
    url = f"{CANVAS_BASE}{path}"
    if params:
        url = f"{url}?{urlencode(params)}"
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=_canvas_headers())
    try:
        with _DIRECT_OPENER.open(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8") if exc.fp else ""
        print(f"Canvas API 错误 {exc.code}: {err_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as exc:
        print(f"网络错误: {exc.reason}", file=sys.stderr)
        sys.exit(1)


def _canvas_get(path: str, params: dict | None = None) -> dict:
    return _request_json("GET", path, params=params)


def _canvas_post(path: str, body: dict) -> dict:
    return _request_json("POST", path, body=body)


def _canvas_patch(path: str, body: dict) -> dict:
    return _request_json("PATCH", path, body=body)


def _canvas_delete(path: str) -> dict:
    return _request_json("DELETE", path)


def _download_bytes(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "TRIX-Canvas-Skill/1.0"})
    with _DIRECT_OPENER.open(req, timeout=timeout) as resp:
        chunks = []
        downloaded = 0
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            downloaded += len(chunk)
            if downloaded > MAX_DOWNLOAD_SIZE:
                raise ValueError(
                    f"下载文件超过 {MAX_DOWNLOAD_SIZE // (1024 * 1024)}MB 上限: {url}"
                )
            chunks.append(chunk)
        return b"".join(chunks)


# ---------- Canvas API 封装 ----------


def create_project(name: str, script_text: str = "") -> dict:
    return _canvas_post("/api/projects", {"name": name, "script_text": script_text})


def get_project(project_id: str) -> dict:
    resp = _canvas_get(f"/api/projects/{project_id}")
    return resp.get("data") if isinstance(resp, dict) else resp


def list_projects() -> list:
    resp = _canvas_get("/api/projects")
    return resp.get("data", []) if isinstance(resp, dict) else resp


def list_project_files(project_id: str) -> list:
    resp = _canvas_get(f"/api/projects/{project_id}/files")
    return resp.get("data", []) if isinstance(resp, dict) else resp


def upload_file(
    project_id: str,
    file_data: bytes,
    filename: str,
    mime_type: str = "image/png",
    media_type: str = "image",
    prompt: str = "",
    scene_id: int | None = None,
    node_id: str | None = None,
    external_url: str | None = None,
) -> dict:
    """上传文件到 Canvas（JSON base64 或远端 URL）"""
    import base64

    payload = {
        "project_id": str(project_id),
        "filename": filename,
        "mimeType": mime_type,
        "mediaType": media_type,
        "prompt": prompt,
    }
    if file_data:
        payload["fileData"] = base64.b64encode(file_data).decode("ascii")
    if scene_id is not None:
        payload["scene_id"] = scene_id
    if node_id:
        payload["node_id"] = str(node_id)
    if external_url:
        payload["external_url"] = external_url
    return _canvas_post("/api/upload", payload)


def create_node(
    project_id: str,
    file_id: str | None = None,
    scene_id: int | None = None,
    media_type: str = "image",
    x: float = 0,
    y: float = 0,
    prompt: str = "",
    status: str = "done",
    task_id: str = "",
    parent_node_id: str | None = None,
    result_url: str | None = None,
) -> dict:
    body = {
        "project_id": str(project_id),
        "media_type": media_type,
        "x": x,
        "y": y,
        "prompt": prompt,
        "status": status,
    }
    if file_id is not None:
        body["file_id"] = str(file_id)
    if scene_id is not None:
        body["scene_id"] = scene_id
    if task_id:
        body["task_id"] = task_id
    if parent_node_id:
        body["parent_node_id"] = str(parent_node_id)
    if result_url:
        body["result_url"] = result_url
    return _canvas_post("/api/nodes", body)


def update_node(node_id: str, **fields) -> dict:
    return _canvas_patch(f"/api/nodes/{node_id}", fields)


def create_edge(
    project_id: str,
    source_node_id: str,
    target_node_id: str,
    edge_type: str = "scene_order",
) -> dict:
    return _canvas_post(
        "/api/edges",
        {
            "project_id": str(project_id),
            "source_node_id": str(source_node_id),
            "target_node_id": str(target_node_id),
            "edge_type": edge_type,
        },
    )


def create_session(
    message: str,
    project_id: str | None = None,
    session_id: str | None = None,
    media_type: str = "image",
    aspect: str = "origin",
    style: str = "",
    parent_node_id: str | None = None,
) -> dict:
    body = {
        "message": message,
        "mediaType": media_type,
        "aspect": aspect,
        "style": style,
    }
    if project_id is not None:
        body["projectId"] = str(project_id)
    if session_id:
        body["sessionId"] = session_id
    if parent_node_id:
        body["parentNodeId"] = str(parent_node_id)
    return _canvas_post("/api/session", body)


def query_session(session_id: str, after_seq: int = 0) -> dict:
    params = {"afterSeq": after_seq} if after_seq else None
    resp = _canvas_get(f"/api/session/{session_id}", params=params)
    return resp.get("data", resp) if isinstance(resp, dict) else resp


def wait_for_session(session_id: str, timeout: int = 300, poll_interval: int = 2) -> dict:
    started_at = time.time()
    last_payload = {}
    while time.time() - started_at <= timeout:
        payload = query_session(session_id)
        last_payload = payload
        status = str(payload.get("status", "")).lower()
        if status in {"completed", "error", "failed"}:
            return payload
        time.sleep(poll_interval)
    return {
        "status": "timeout",
        "sessionId": session_id,
        "error": f"轮询超时（>{timeout}s）",
        "last": last_payload,
    }


def change_project() -> dict:
    return _canvas_post("/api/session/change-project", {})


def export_subtitle(project_id: str) -> dict:
    return _canvas_get(f"/api/projects/{project_id}/export/subtitle")


def export_video(project_id: str, aspect: str = "origin") -> dict:
    return _canvas_get(f"/api/projects/{project_id}/export/video", params={"aspect": aspect})


# ---------- 本地文件解析 / 媒体下载 ----------


def _normalize_media_identifier(path_or_url: str) -> str:
    candidate = (path_or_url or "").strip()
    if not candidate:
        raise ValueError("媒体路径不能为空")
    if candidate.startswith("http://") or candidate.startswith("https://"):
        parsed = urlparse(candidate)
        return os.path.basename(parsed.path)
    if candidate.startswith("/media/files/") or candidate.startswith("/media/exports/"):
        return os.path.basename(candidate)
    return os.path.basename(candidate)


def get_file_path(path_or_url: str, bucket: str = "blobs") -> str:
    filename = _normalize_media_identifier(path_or_url)
    ext = Path(filename).suffix.lower()
    if ext and ext not in SAFE_EXTS:
        raise ValueError(f"Unsupported file extension: {ext}")
    local = (CANVAS_LOCAL_DIR / bucket / filename).resolve()
    root = (CANVAS_LOCAL_DIR / bucket).resolve()
    if not str(local).startswith(str(root) + os.sep) and local != root:
        raise ValueError(f"Path traversal attempt: {path_or_url}")
    return str(local)


def download_url(url: str, timeout: int = 120) -> bytes:
    return _download_bytes(url, timeout=timeout)


def download_media(path_or_url: str, timeout: int = 120) -> bytes:
    """
    从 Canvas 本地存储或服务下载媒体文件。
    支持文件名、/media/files/... 或完整 URL。
    """
    candidate = (path_or_url or "").strip()
    if not candidate:
        raise ValueError("下载路径不能为空")

    if candidate.startswith("http://") or candidate.startswith("https://"):
        return _download_bytes(candidate, timeout=timeout)

    if candidate.startswith("/media/exports/"):
        url = f"{CANVAS_BASE}{candidate}"
        return _download_bytes(url, timeout=timeout)

    if candidate.startswith("/media/files/"):
        filename = _normalize_media_identifier(candidate)
    else:
        filename = _normalize_media_identifier(candidate)

    try:
        local = get_file_path(filename)
        if os.path.exists(local):
            with open(local, "rb") as fh:
                return fh.read()
    except Exception:
        pass

    return _download_bytes(f"{CANVAS_BASE}/media/files/{filename}", timeout=timeout)
