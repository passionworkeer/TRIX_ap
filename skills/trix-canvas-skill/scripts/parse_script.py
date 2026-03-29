"""AI 解析剧本 → JSON 分镜列表"""

import json
import re
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "adapters"))
from trix_adapter import TRIXAdapter

import _common


def parse_script(script_text: str) -> list:
    """
    调用 AI 解析剧本文本，返回分镜列表。
    每个分镜: { "index": int, "text": str, "media_type": "image"|"video" }
    如果 AI 未配置或失败，回退到按行拆分。
    """
    # 如果 AI API 未配置，直接用按行拆分
    if not _common.AI_API_BASE:
        print(
            "[INFO] AI API not configured, using line-by-line parsing", file=sys.stderr
        )
        return _fallback_parse(script_text)

    prompt = (
        "Parse the following script into storyboard scenes. Output JSON array.\n"
        "Each element:\n"
        '  - "index": scene number (start from 1)\n'
        '  - "text": scene description for AI image generation\n'
        '  - "media_type": "image" or "video"\n'
        "Output ONLY JSON.\n\n"
        f"Script:\n{script_text}"
    )

    try:
        adapter = TRIXAdapter(_common.AI_API_BASE, _common.AI_API_KEY)
        result = adapter.generate(prompt, media_type="image")

        if not result["ok"]:
            print(
                f"[WARN] AI parse failed: {result.get('error')}, using fallback",
                file=sys.stderr,
            )
            return _fallback_parse(script_text)

        # 尝试从返回内容中提取 JSON
        try:
            text = result.get("bytes", b"").decode("utf-8", errors="replace")
        except Exception:
            text = str(result)

        match = re.search(r"\[.*\]", text, re.DOTALL)
        if match:
            scenes = json.loads(match.group())
            return scenes
        else:
            return _fallback_parse(script_text)

    except Exception as e:
        print(f"[WARN] AI parse error: {e}, using fallback", file=sys.stderr)
        return _fallback_parse(script_text)


def _fallback_parse(script_text: str) -> list:
    """按行拆分剧本文本"""
    lines = [l.strip() for l in script_text.strip().split("\n") if l.strip()]
    return [
        {"index": i + 1, "text": line, "media_type": "image"}
        for i, line in enumerate(lines)
    ]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Parse script to scenes")
    parser.add_argument("script", help="Script text or file path")
    args = parser.parse_args()

    if os.path.isfile(args.script):
        with open(args.script, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = args.script

    scenes = parse_script(text)
    print(json.dumps(scenes, ensure_ascii=False, indent=2))
