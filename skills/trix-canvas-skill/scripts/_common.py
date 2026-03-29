"""TRIX Canvas Skill — 公共模块：配置、HTTP 工具、Canvas API 封装"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

# ---------- 配置 ----------
CANVAS_BASE = os.environ.get("CANVAS_BASE_URL", "http://localhost:8789")
AI_API_BASE = os.environ.get("AI_API_BASE", "")
AI_API_KEY = os.environ.get("AI_API_KEY", "")
EXTRA_HEADERS = {}

raw_headers = os.environ.get("AI_EXTRA_HEADERS", "")
if raw_headers:
    for line in raw_headers.strip().split("\n"):
        idx = line.index(":") if ":" in line else -1
        if idx > 0:
            key = line[:idx].strip()
            val = line[idx + 1 :].strip()
            if key and val:
                EXTRA_HEADERS[key] = val


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if AI_API_KEY:
        h["Authorization"] = f"Bearer {AI_API_KEY}"
    h.update(EXTRA_HEADERS)
    return h


def _canvas_get(path: str) -> dict:
    url = f"{CANVAS_BASE.rstrip('/')}{path}"
    req = urllib.request.Request(
        url, method="GET", headers={"Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        print(f"Canvas API 错误 {e.code}: {err_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"网络错误: {e.reason}", file=sys.stderr)
        sys.exit(1)


def _canvas_post(path: str, body: dict) -> dict:
    url = f"{CANVAS_BASE.rstrip('/')}{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST", headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        print(f"Canvas API 错误 {e.code}: {err_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"网络错误: {e.reason}", file=sys.stderr)
        sys.exit(1)


def _canvas_patch(path: str, body: dict) -> dict:
    url = f"{CANVAS_BASE.rstrip('/')}{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="PATCH", headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        print(f"Canvas API 错误 {e.code}: {err_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"网络错误: {e.reason}", file=sys.stderr)
        sys.exit(1)


def _canvas_delete(path: str) -> dict:
    url = f"{CANVAS_BASE.rstrip('/')}{path}"
    req = urllib.request.Request(url, method="DELETE", headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        print(f"Canvas API 错误 {e.code}: {err_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"网络错误: {e.reason}", file=sys.stderr)
        sys.exit(1)


def _download_bytes(url: str) -> bytes:
    """下载文件为 bytes"""
    req = urllib.request.Request(url, headers={"User-Agent": "TRIX-Canvas-Skill/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


# ---------- Canvas API 封装 ----------


def create_project(name: str, script_text: str = "") -> dict:
    return _canvas_post("/api/projects", {"name": name, "script_text": script_text})


def get_project(project_id: int) -> dict:
    return _canvas_get(f"/api/projects/{project_id}")


def list_projects() -> list:
    return _canvas_get("/api/projects")


def upload_file(
    project_id: int,
    file_data: bytes,
    filename: str,
    mime_type: str = "image/png",
    media_type: str = "image",
    prompt: str = "",
    scene_id: int = None,
) -> dict:
    """上传文件到 Canvas（multipart）"""
    import io

    boundary = "----TRIXBoundary" + str(int(time.time()))
    body = io.BytesIO()

    def write_field(name, value):
        body.write(f"--{boundary}\r\n".encode())
        body.write(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.write(f"{value}\r\n".encode())

    write_field("project_id", str(project_id))
    write_field("prompt", prompt)
    write_field("media_type", media_type)
    if scene_id is not None:
        write_field("scene_id", str(scene_id))

    body.write(f"--{boundary}\r\n".encode())
    body.write(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
    )
    body.write(f"Content-Type: {mime_type}\r\n\r\n".encode())
    body.write(file_data)
    body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    url = f"{CANVAS_BASE.rstrip('/')}/api/upload"
    req = urllib.request.Request(
        url,
        data=body.getvalue(),
        method="POST",
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        print(f"上传失败 {e.code}: {err_body}", file=sys.stderr)
        sys.exit(1)


def create_node(
    project_id: int,
    file_id: int = None,
    scene_id: int = None,
    media_type: str = "image",
    x: float = 0,
    y: float = 0,
    prompt: str = "",
    status: str = "done",
    task_id: str = "",
) -> dict:
    body = {
        "project_id": project_id,
        "media_type": media_type,
        "x": x,
        "y": y,
        "prompt": prompt,
        "status": status,
    }
    if file_id is not None:
        body["file_id"] = file_id
    if scene_id is not None:
        body["scene_id"] = scene_id
    if task_id:
        body["task_id"] = task_id
    return _canvas_post("/api/nodes", body)


def update_node(node_id: int, **fields) -> dict:
    return _canvas_patch(f"/api/nodes/{node_id}", fields)


def create_edge(
    project_id: int,
    source_node_id: int,
    target_node_id: int,
    edge_type: str = "scene_order",
) -> dict:
    return _canvas_post(
        "/api/edges",
        {
            "project_id": project_id,
            "source_node_id": source_node_id,
            "target_node_id": target_node_id,
            "edge_type": edge_type,
        },
    )


def query_session(session_id: str) -> dict:
    """查询 AI 会话状态"""
    url = f"{AI_API_BASE.rstrip('/')}/api/session/{session_id}"
    req = urllib.request.Request(url, method="GET", headers=_headers())
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ---------- 本地文件解析（CLI 脚本专用）----------
# Canvas 服务器存储在 ~/.trix-canvas/，通过 /media/ 接口访问
CANVAS_LOCAL_DIR = os.path.normpath(os.path.join(os.path.expanduser("~"), ".trix-canvas"))

# 安全：允许的文件扩展名白名单（防止恶意文件类型）
SAFE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".mov", ".avi", ".mkv"}


def get_file_path(rel_path: str) -> str:
    """将 Canvas 相对路径转为本地绝对路径（防路径穿越）"""
    # 禁止 ../ 穿越
    if ".." in rel_path or rel_path.startswith("/"):
        raise ValueError(f"Invalid path traversal attempt: {rel_path}")
    joined = os.path.normpath(os.path.join(CANVAS_LOCAL_DIR, rel_path))
    # normpath 后再次检查是否在 CANVAS_LOCAL_DIR 内
    if not joined.startswith(os.path.normpath(CANVAS_LOCAL_DIR) + os.sep):
        raise ValueError(f"Path traversal attempt: {rel_path}")
    return joined


def list_project_files(project_id: int) -> list:
    """获取项目的文件列表"""
    return _canvas_get(f"/api/projects/{project_id}/files")


# ---------- 媒体下载 ----------
MAX_DOWNLOAD_SIZE = 500 * 1024 * 1024  # 500 MB，上限防护


def download_media(rel_path: str, timeout: int = 120) -> bytes:
    """
    从 Canvas 本地存储或服务下载媒体文件。
    rel_path: 相对路径，如 "projects/1/abc123_photo.png"
    """
    # 本地文件优先（避免网络开销）
    try:
        local = get_file_path(rel_path)
        if os.path.exists(local):
            with open(local, "rb") as fh:
                return fh.read()
    except Exception:
        pass

    # 网络下载兜底（加文件大小限制防止内存耗尽）
    url = f"{CANVAS_BASE.rstrip('/')}/media/{rel_path}"
    req = urllib.request.Request(url, headers={"User-Agent": "TRIX-Canvas-Skill/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        # 分块读取，超限抛异常
        chunks = []
        downloaded = 0
        while True:
            chunk = resp.read(1024 * 1024)  # 1MB per read
            if not chunk:
                break
            downloaded += len(chunk)
            if downloaded > MAX_DOWNLOAD_SIZE:
                raise ValueError(
                    f"下载文件超过 {MAX_DOWNLOAD_SIZE // (1024*1024)}MB 上限: {rel_path}"
                )
            chunks.append(chunk)
        return b"".join(chunks)

