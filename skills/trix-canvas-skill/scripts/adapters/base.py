"""Adapter 基类：统一 AI 生成接口"""


class AIAdapter:
    """AI 生成适配器基类，屏蔽同步/异步差异"""

    def generate(self, prompt: str, media_type: str = "image") -> dict:
        """
        统一生成接口。
        返回: { "ok": True, "bytes": <二进制>, "mime": "image/png" | "video/mp4" }
              或 { "ok": False, "error": "..." }
        """
        raise NotImplementedError
