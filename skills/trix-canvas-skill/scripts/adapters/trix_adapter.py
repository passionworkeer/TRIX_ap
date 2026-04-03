"""TRIX AI 适配器：通过 Canvas Session 统一同步调用"""

import json
import re
import time
import urllib.request
from urllib.parse import urljoin, urlparse

from adapters.base import AIAdapter

MEDIA_PATTERN = re.compile(
    r'https?://[^\s"\'<>\[\]]+\.(?:png|jpg|jpeg|webp|gif|mp4|mov)', re.IGNORECASE
)
DIRECT_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


class TRIXAdapter(AIAdapter):
    """TRIX AI 适配器：统一同步调用 Canvas /api/session"""

    def __init__(self, api_base: str, api_key: str = ""):
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self._api_base_parsed = urlparse(self.api_base)
        self._session_create_url = f"{self.api_base}/api/session"
        self._max_polls = 150
        self._poll_interval = 2

    def generate(self, prompt: str, media_type: str = "image") -> dict:
        session = self._create_session(prompt, media_type)
        session_id = session.get("sessionId", "")
        if not session_id:
            return {"ok": False, "error": "sessionId 缺失"}
        return self._poll(session_id)

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _create_session(self, message: str, media_type: str) -> dict:
        body = json.dumps({"message": message, "mediaType": media_type}).encode()
        req = urllib.request.Request(
            self._session_create_url,
            data=body,
            method="POST",
            headers=self._headers(),
        )
        with DIRECT_OPENER.open(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("data", data)

    def _poll(self, session_id: str) -> dict:
        url = f"{self.api_base}/api/session/{session_id}"
        for attempt in range(self._max_polls):
            if attempt > 0:
                time.sleep(self._poll_interval)
            req = urllib.request.Request(url, method="GET", headers=self._headers())
            try:
                with DIRECT_OPENER.open(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    data = data.get("data", data)
            except urllib.error.HTTPError as exc:
                if exc.code in (401, 403):
                    return {"ok": False, "error": f"Canvas 鉴权失败: {exc.code}"}
                if exc.code == 429:
                    return {"ok": False, "error": f"Canvas 请求限流 (429)，请稍后重试"}
                # 其他 HTTP 错误 → 继续轮询
                continue
            except urllib.error.URLError:
                # 网络错误 → 继续轮询
                continue
            except Exception:
                # 未知错误 → 继续轮询，不静默吞掉
                continue

            status = str(data.get("status", "")).lower()
            if status == "completed":
                return self._extract_bytes_from_session(data)
            if status in {"error", "failed"}:
                return {
                    "ok": False,
                    "error": f"AI 生成失败: {data.get('error', '未知错误')}",
                }

        return {"ok": False, "error": "轮询超时（5分钟）"}

    def _extract_bytes_from_session(self, session_data: dict) -> dict:
        urls = []
        for candidate in (
            session_data.get("resultUrls", []),
            session_data.get("result_urls", []),
        ):
            if isinstance(candidate, list):
                urls.extend(candidate)
        result_url = session_data.get("resultUrl") or session_data.get("result_url")
        if result_url:
            urls.append(result_url)

        if not urls:
            for msg in session_data.get("messages", []):
                content = msg.get("content", "") if isinstance(msg, dict) else str(msg)
                urls.extend(MEDIA_PATTERN.findall(content))

        if not urls:
            return {"ok": False, "error": "session 中未找到产出 URL"}

        media_url = self._resolve_media_url(urls[0])
        headers = {"User-Agent": "TRIX-Canvas-Skill/1.0"}
        if self.api_key and self._is_same_origin(media_url):
            headers["Authorization"] = f"Bearer {self.api_key}"
        req = urllib.request.Request(
            media_url,
            headers=headers,
        )
        try:
            with DIRECT_OPENER.open(req, timeout=60) as resp:
                content_type = resp.headers.get("Content-Type", "")
                bytes_data = resp.read()
        except Exception as exc:
            return {"ok": False, "error": f"下载失败: {exc}"}

        mime = content_type or self._ext_to_mime(media_url)
        return {"ok": True, "bytes": bytes_data, "mime": mime}

    def _resolve_media_url(self, url: str) -> str:
        if url.startswith("http://") or url.startswith("https://"):
            return url
        return urljoin(f"{self.api_base}/", url.lstrip("/"))

    def _is_same_origin(self, url: str) -> bool:
        parsed = urlparse(url)
        return (
            parsed.scheme == self._api_base_parsed.scheme
            and parsed.netloc == self._api_base_parsed.netloc
        )

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
