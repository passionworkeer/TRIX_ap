"""TRIX Gen Skill - 公共模块：会话管理、轮询、文件下载（对接 Canvas 服务）"""

import json
import os
import sys
import urllib.request
import urllib.error

# ---------- 配置 ----------
CANVAS_BASE = os.environ.get("CANVAS_BASE_URL", "http://localhost:8789")
AI_API_BASE = os.environ.get("AI_API_BASE", "")
AI_API_KEY = os.environ.get("AI_API_KEY", "")
UPLOAD_API_URL = os.environ.get("UPLOAD_API_URL", "")
EXTRA_HEADERS = {}

raw_headers = os.environ.get("AI_EXTRA_HEADERS", "")
if raw_headers:
    for line in raw_headers.strip().split("\n"):
        idx = line.index(":") if ":" in line else -1
        if idx > 0:
            key = line[:idx].strip()
            val = line[idx + 1:].strip()
            if key and val:
                EXTRA_HEADERS[key] = val

PROJECT_CANVAS_BASE = f"{CANVAS_BASE}/canvas?projectId="


def build_project_url(project_id: str) -> str:
    """拼接画布访问地址"""
    if not project_id:
        return ""
    return PROJECT_CANVAS_BASE + project_id.strip()


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if AI_API_KEY:
        h["Authorization"] = f"Bearer {AI_API_KEY}"
    h.update(EXTRA_HEADERS)
    return h


def _canvas_get(path: str) -> dict:
    """请求 Canvas 服务（本地轮询）"""
    url = f"{CANVAS_BASE.rstrip('/')}{path}"
    req = urllib.request.Request(url, method="GET", headers={"Accept": "application/json"})
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
    """POST 请求 Canvas 服务"""
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


def create_session(session_id: str = "", message: str = "") -> dict:
    """
    创建新会话并提交生成任务。
    返回 data: { projectUuid, sessionId, taskId, projectUrl }。
    """
    body = {}
    if session_id:
        body["sessionId"] = session_id
    if message:
        body["message"] = message
    resp = _canvas_post("/api/session", body)
    return resp.get("data", {})


def query_session(session_id: str, after_seq: int = 0) -> dict:
    """
    查询会话消息列表（轮询生成状态）。
    返回 data: { sessionId, status, messages, resultUrls }。
    """
    path = f"/api/session/{session_id}"
    if after_seq > 0:
        path += f"?afterSeq={after_seq}"
    resp = _canvas_get(path)
    return resp.get("data", {})


def change_project() -> dict:
    """
    切换/创建新项目，返回新项目 ID 和画布地址。
    返回 data: { projectUuid, projectUrl }。
    """
    resp = _canvas_post("/api/session/change-project", {})
    return resp.get("data", {})
