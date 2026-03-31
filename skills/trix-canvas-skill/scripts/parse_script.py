"""解析剧本 → 分镜列表"""

from __future__ import annotations

import json
import os
import re


SCENE_MARKERS = re.compile(
    r"^\s*(?:scene|shot|chapter|chapter\s+\d+|镜头|场景|第[\d一二三四五六七八九十百]+[幕场镜章节])",
    re.IGNORECASE,
)
MEDIA_PREFIX = re.compile(r"^\s*(image|video)\s*::\s*", re.IGNORECASE)


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
    scenes = []
    for idx, block in enumerate(blocks, 1):
        media_type, scene_text = _extract_media_type_and_text(block)
        if scene_text:
            scenes.append({"index": idx, "text": scene_text, "media_type": media_type})
    return scenes


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
            media_type, scene_text = _extract_media_type_and_text(item)
        elif isinstance(item, dict):
            raw_text = str(item.get("text") or item.get("prompt") or "").strip()
            hint = item.get("media_type") or item.get("mediaType") or ""
            media_type, scene_text = _extract_media_type_and_text(raw_text, media_type_hint=str(hint))
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
        if current and (SCENE_MARKERS.match(line) or MEDIA_PREFIX.match(line)):
            blocks.append(_collapse_whitespace(" ".join(current)))
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append(_collapse_whitespace(" ".join(current)))
    return blocks


def _collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _normalize_media_type(media_type: str) -> str:
    lowered = str(media_type or "").strip().lower()
    return lowered if lowered in {"image", "video"} else "image"


def _extract_media_type_and_text(text: str, media_type_hint: str = "") -> tuple[str, str]:
    scene_text = str(text or "").strip()
    prefixed_match = MEDIA_PREFIX.match(scene_text)
    if prefixed_match:
        media_type = _normalize_media_type(prefixed_match.group(1))
        scene_text = scene_text[prefixed_match.end():].strip()
        return media_type, _collapse_whitespace(scene_text)
    return _normalize_media_type(media_type_hint), _collapse_whitespace(scene_text)


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
