"""通过 Canvas 服务导出 .srt 字幕 + 台词文档"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys

import _common


def _materialize_file(source_path: str | None, source_url: str | None, output_dir: str, fallback_name: str) -> str | None:
    os.makedirs(output_dir, exist_ok=True)
    dest_path = os.path.join(output_dir, fallback_name)

    if source_path and os.path.exists(source_path):
        shutil.copy2(source_path, dest_path)
        return dest_path

    if source_url:
        payload = source_url
        if source_url.startswith("/"):
            payload = f"{_common.CANVAS_BASE}{source_url}"
        with open(dest_path, "wb") as fh:
            fh.write(_common.download_url(payload))
        return dest_path

    return None


def export(project_id: str, output_dir: str = "") -> dict:
    payload = _common.export_subtitle(project_id)
    result = {
        "ok": True,
        "srt": payload.get("srt"),
        "script": payload.get("script"),
        "srt_url": payload.get("srt_url"),
        "script_url": payload.get("script_url"),
        "total_duration": payload.get("total_duration"),
        "scenes": payload.get("scenes"),
    }

    if output_dir:
        srt_name = os.path.basename(result["srt"] or result["srt_url"] or "project.srt")
        script_name = os.path.basename(result["script"] or result["script_url"] or "project_script.md")
        local_srt = _materialize_file(result["srt"], result["srt_url"], output_dir, srt_name)
        local_script = _materialize_file(result["script"], result["script_url"], output_dir, script_name)
        if local_srt:
            result["srt"] = local_srt
        if local_script:
            result["script"] = local_script

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="导出字幕和台词")
    parser.add_argument("project_id")
    parser.add_argument("--output-dir", "-d", default="")
    args = parser.parse_args()

    result = export(args.project_id, args.output_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        sys.exit(1)
