"""批量下载 Canvas 项目生成结果"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import _common


def run(
    project_id: str,
    dest_dir: str | None = None,
    media_types: list[str] | None = None,
) -> dict:
    files = _common.list_project_files(project_id)
    if not files:
        return {"ok": False, "error": "项目没有文件"}

    out_dir = Path(dest_dir or f"canvas_project_{project_id}_results")
    out_dir.mkdir(parents=True, exist_ok=True)
    downloaded = []

    for file in files:
        media_type = file.get("mediaType") or file.get("media_type")
        if media_types and media_type not in media_types:
            continue

        source = file.get("url") or file.get("storedFilename") or file.get("stored_filename")
        if not source:
            continue

        try:
            data = _common.download_media(source)
        except Exception:
            continue

        file_id = file.get("id", "file")
        filename = file.get("filename") or _common._normalize_media_identifier(source)
        safe_name = f"{file_id}_{filename}".replace("/", "_")
        dest_path = out_dir / safe_name
        with open(dest_path, "wb") as fh:
            fh.write(data)
        downloaded.append(str(dest_path))

    if not downloaded:
        return {"ok": False, "error": "没有成功下载任何文件"}

    return {
        "ok": True,
        "count": len(downloaded),
        "files": downloaded,
        "directory": str(out_dir),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="下载 Canvas 项目生成结果")
    parser.add_argument("project_id", help="Canvas 项目 ID")
    parser.add_argument("--dest", help="结果保存目录")
    parser.add_argument(
        "--media-types",
        nargs="*",
        default=None,
        help="只下载哪些媒体类型（image/video）",
    )
    args = parser.parse_args()

    result = run(args.project_id, args.dest, args.media_types)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result.get("ok", False):
        sys.exit(1)
