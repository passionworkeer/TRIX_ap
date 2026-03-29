"""TRIX AI 适配器：统一同步调用，自动处理同步/异步返回"""

import json
import re
import time
import urllib.request
import urllib.error

from base import AIAdapter

MEDIA_PATTERN = re.compile(
    r'https?://[^\s"\'<>\[\]]+\.(?:png|jpg|jpeg|webp|mp4|mov)', re.IGNORECASE
)


class TRIXAdapter(AIAdapter):
    """TRIX AI 适配器：统一同步调用"""

    def __init__(self, api_base: str, api_key: str = ""):
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self._session_create_url = f"{self.api_base}/api/session"
        self._max_polls = 60
        self._poll_interval = 5

    def generate(self, prompt: str, media_type: str = "image") -> dict:
        if media_type == "image":
            return self._generate_image(prompt)
        else:
            return self._generate_video(prompt)

    # ---------- 内部实现 ----------

    def _generate_image(self, prompt: str) -> dict:
        session = self._create_session(prompt)
        task_id = session.get("taskId")

        if not task_id:
            return self._extract_bytes_from_session(session)

        return self._poll(task_id, session.get("sessionId", ""))

    def _generate_video(self, prompt: str) -> dict:
        return self._generate_image(prompt)

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    def _create_session(self, message: str) -> dict:
        body = json.dumps({"message": message}).encode()
        req = urllib.request.Request(
            self._session_create_url, data=body, method="POST", headers=self._headers()
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("data", data)

    def _poll(self, task_id: str, session_id: str) -> dict:
        for _ in range(self._max_polls):
            time.sleep(self._poll_interval)

            url = f"{self.api_base}/api/session/{session_id}"
            req = urllib.request.Request(url, method="GET", headers=self._headers())
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    data = data.get("data", data)
            except Exception as e:
                continue

            status = data.get("status", "")
            if status == "completed":
                return self._extract_bytes_from_session(data)
            elif status == "failed":
                return {
                    "ok": False,
                    "error": f"AI 生成失败: {data.get('error', '未知错误')}",
                }

        return {"ok": False, "error": "轮询超时（5分钟）"}

    def _extract_bytes_from_session(self, session_data: dict) -> dict:
        urls = session_data.get("resultUrls", [])
        if not urls:
            for msg in session_data.get("messages", []):
                content = msg.get("content", "") if isinstance(msg, dict) else str(msg)
                found = MEDIA_PATTERN.findall(content)
                urls.extend(found)

        if not urls:
            return {"ok": False, "error": "session 中未找到产出 URL"}

        url = urls[0]
        req = urllib.request.Request(
            url, headers={"User-Agent": "TRIX-Canvas-Skill/1.0"}
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                content_type = resp.headers.get("Content-Type", "")
                bytes_data = resp.read()
        except Exception as e:
            return {"ok": False, "error": f"下载失败: {e}"}

        mime = self._ext_to_mime(url)
        return {"ok": True, "bytes": bytes_data, "mime": content_type or mime}

    @staticmethod
    def _ext_to_mime(url: str) -> str:
        ext = url.split("?")[0].rsplit(".", 1)[-1].lower()
        return {
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "webp": "image/webp",
            "gif": "image/gif",
            "mp4": "video/mp4",
            "mov": "video/quicktime",
        }.get(ext, "application/octet-stream")
