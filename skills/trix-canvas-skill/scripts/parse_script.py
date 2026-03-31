"""解析剧本 → 分镜列表"""

from __future__ import annotations

import json
import os
import re


SCENE_MARKERS = re.compile(
    r"^\s*(?:scene|shot|chapter|chapter\s+\d+|镜头|场景|第[\d一二三四五六七八九十百]+[幕场镜章节])",
    re.IGNORECASE,
)


def parse_script(script_text: str) -> list:
    """
    将剧本文本解析为分镜列表。

    优先支持：
    1. 已经是 JSON 数组
    2. 空行分段
    3. 按行拆分
    """
    text = script_text.strip()
    if not text:
        return []

    json_scenes = _try_parse_json(text)
    if json_scenes is not None:
        return json_scenes

    blocks = _split_blocks(text)
    return [
        {"index": idx, "text": block, "media_type": "image"}
        for idx, block in enumerate(blocks, 1)
    ]


def _try_parse_json(text: str) -> list | None:
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None

    if not isinstance(payload, list):
        return None

    scenes = []
    for index, item in enumerate(payload, 1):
        if isinstance(item, str):
            scene_text = item.strip()
            media_type = "image"
        elif isinstance(item, dict):
            scene_text = str(item.get("text") or item.get("prompt") or "").strip()
            media_type = str(item.get("media_type") or item.get("mediaType") or "image")
        else:
            continue
        if scene_text:
            scenes.append({"index": index, "text": scene_text, "media_type": media_type})
    return scenes or None


def _split_blocks(text: str) -> list[str]:
    paragraphs = [segment.strip() for segment in re.split(r"\n\s*\n+", text) if segment.strip()]
    if len(paragraphs) > 1:
        return [_collapse_whitespace(item) for item in paragraphs]

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return []

    blocks = []
    current = []
    for line in lines:
        if current and SCENE_MARKERS.match(line):
            blocks.append(_collapse_whitespace(" ".join(current)))
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append(_collapse_whitespace(" ".join(current)))
    return blocks


def _collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Parse script to scenes")
    parser.add_argument("script", help="Script text or file path")
    args = parser.parse_args()

    if os.path.isfile(args.script):
        with open(args.script, "r", encoding="utf-8") as fh:
            text = fh.read()
    else:
        text = args.script

    scenes = parse_script(text)
    print(json.dumps(scenes, ensure_ascii=False, indent=2))
