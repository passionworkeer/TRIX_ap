"""TRIX Canvas Skill — 公共模块：配置、HTTP 工具、Canvas API 封装"""

from __future__ import annotations

import json
import os
import socket
import time
import urllib.error
import urllib.request
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import urlencode, urlparse

from _paths import default_canvas_data_dir

# ---------- 配置 ----------
CANVAS_BASE = os.environ.get("CANVAS_BASE_URL", "http://localhost:8789").rstrip("/")
AI_API_BASE = os.environ.get("AI_API_BASE", "")
AI_API_KEY = os.environ.get("AI_API_KEY", "")
ALLOW_PRIVATE_REMOTE_URLS = os.environ.get("CANVAS_ALLOW_PRIVATE_REMOTE_URLS", "").strip().lower() in {
    "1",
    "true",
    "yes",
}
if ALLOW_PRIVATE_REMOTE_URLS:
    import warnings
    warnings.warn(
        "[SECURITY WARNING] CANVAS_ALLOW_PRIVATE_REMOTE_URLS is set — "
        "SSRF protection is DISABLED. Do NOT use in production or untrusted networks. "
        "Only enable for local development with an air-gapped AI backend.",
        RuntimeWarning,
        stacklevel=2,
    )
_CANVAS_BASE_PARSED = urlparse(CANVAS_BASE)

CANVAS_LOCAL_DIR = Path(
    os.environ.get("CANVAS_DATA_DIR", str(default_canvas_data_dir()))
).resolve()
CANVAS_AUTH_TOKEN_FILE = Path(
    os.environ.get("CANVAS_AUTH_TOKEN_FILE", str(CANVAS_LOCAL_DIR / ".canvas-access-token"))
).resolve()


def _load_canvas_access_token() -> str:
    explicit = os.environ.get("CANVAS_ACCESS_TOKEN", "").strip()
    if explicit:
        return explicit
    try:
        if CANVAS_AUTH_TOKEN_FILE.exists():
            return CANVAS_AUTH_TOKEN_FILE.read_text(encoding="utf-8").strip()
    except OSError:
        return ""
    return ""


def get_canvas_access_token() -> str:
    """Read the latest Canvas token from env/file at call time."""
    return _load_canvas_access_token()

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


class CanvasRequestError(RuntimeError):
    """Raised when the canvas HTTP API returns an error or cannot be reached."""


def _canvas_headers() -> dict:
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    token = get_canvas_access_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


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
        detail = f": {err_body}" if err_body else ""
        raise CanvasRequestError(f"Canvas API 错误 {exc.code}{detail}") from exc
    except urllib.error.URLError as exc:
        raise CanvasRequestError(f"网络错误: {exc.reason}") from exc


def _canvas_get(path: str, params: dict | None = None) -> dict:
    return _request_json("GET", path, params=params)


def _canvas_post(path: str, body: dict) -> dict:
    return _request_json("POST", path, body=body)


def _canvas_patch(path: str, body: dict) -> dict:
    return _request_json("PATCH", path, body=body)


def _canvas_delete(path: str) -> dict:
    return _request_json("DELETE", path)


def _is_same_canvas_origin(url: str) -> bool:
    parsed = urlparse(url)
    return (
        parsed.scheme == _CANVAS_BASE_PARSED.scheme
        and parsed.netloc == _CANVAS_BASE_PARSED.netloc
    )


def _is_private_host(hostname: str) -> bool:
    if not hostname:
        return True
    lowered = hostname.strip().lower()
    if lowered == "localhost" or lowered.endswith(".local"):
        return True
    try:
        return ip_address(lowered).is_private or ip_address(lowered).is_loopback or ip_address(lowered).is_link_local
    except ValueError:
        try:
            infos = socket.getaddrinfo(lowered, None, proto=socket.IPPROTO_TCP)
        except socket.gaierror as exc:
            raise ValueError(f"无法解析下载地址主机: {hostname}") from exc
        for info in infos:
            address = info[4][0]
            candidate = ip_address(address)
            if candidate.is_private or candidate.is_loopback or candidate.is_link_local:
                return True
        return False


def _assert_safe_download_url(url: str) -> str:
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"非法下载地址: {url}")
    if _is_same_canvas_origin(url):
        return url
    if ALLOW_PRIVATE_REMOTE_URLS:
        return url
    if _is_private_host(parsed.hostname or ""):
        raise ValueError(f"禁止访问私有网络地址: {url}")
    return url


def _download_bytes(url: str, timeout: int = 120) -> bytes:
    safe_url = _assert_safe_download_url(url)
    headers = {"User-Agent": "TRIX-Canvas-Skill/1.0"}
    token = get_canvas_access_token()
    if token and _is_same_canvas_origin(safe_url):
        headers["Authorization"] = f"Bearer {token}"

    current_url = safe_url
    remaining_redirects = 10  # prevent redirect loops
    while remaining_redirects >= 0:
        req = urllib.request.Request(current_url, headers=headers)
        try:
            with _DIRECT_OPENER.open(req, timeout=timeout) as resp:
                status = resp.status
                if 300 <= status < 400 and status != 304:
                    location = resp.headers.get("Location") or resp.headers.get("location")
                    if not location:
                        raise ValueError(f"服务器返回 {status} 重定向但未提供 Location 头")
                    # Resolve relative redirects
                    if not location.startswith(("http://", "https://")):
                        parsed_base = urlparse(current_url)
                        location = f"{parsed_base.scheme}://{parsed_base.netloc}{location}"
                    # Re-validate every redirect target
                    _assert_safe_download_url(location)
                    current_url = location
                    remaining_redirects -= 1
                    continue
                # Not a redirect — read the body
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
        except urllib.error.HTTPError as exc:
            if exc.code == 405:
                raise
            raise

    raise ValueError(f"重定向次数超过上限（可能存在循环重定向）: {url}")


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
    type: str | None = None,
    image_size: str | None = None,
    thinking_mode: str | int | None = None,
    input_image: str | None = None,
) -> dict:
    normalized_media_type = type or media_type
    body: dict = {
        "message": message,
        "mediaType": normalized_media_type,
        "aspect": aspect,
        "style": style,
    }
    if project_id is not None:
        body["projectId"] = str(project_id)
    if session_id:
        body["sessionId"] = session_id
    if parent_node_id:
        body["parentNodeId"] = str(parent_node_id)
    if image_size:
        body["imageSize"] = image_size
    if thinking_mode is not None:
        body["thinkingMode"] = thinking_mode
    if input_image:
        body["inputImage"] = input_image
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


def get_canvas_capabilities() -> dict:
    try:
        resp = _canvas_get("/api/capabilities")
    except CanvasRequestError as exc:
        if "404" in str(exc):
            return {}
        raise
    return resp.get("data", resp) if isinstance(resp, dict) else resp


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
