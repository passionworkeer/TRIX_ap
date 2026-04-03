"""通过 Canvas 服务导出拼接视频"""

import argparse
import json
import os
import shutil
import sys

import _common


PRESETS = {
    "9:16": {"desc": "竖屏 9:16"},
    "16:9": {"desc": "横屏 16:9"},
    "1:1": {"desc": "方屏 1:1"},
    "4:3": {"desc": "标准 4:3"},
    "origin": {"desc": "保持原始尺寸"},
}


def export(project_id: str, output: str = "", aspect: str = "origin") -> dict:
    payload = _common.export_video(project_id, aspect=aspect)
    result = {
        "ok": bool(payload.get("ok", True)),
        "path": payload.get("path"),
        "url": payload.get("url"),
        "aspect": payload.get("aspect", aspect),
        "preset": PRESETS.get(payload.get("aspect", aspect), PRESETS["origin"])["desc"],
        "segments": payload.get("segments"),
        "size": payload.get("size"),
    }

    if output:
        out_path = os.path.abspath(output)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        if result["path"] and os.path.exists(result["path"]):
            shutil.copy2(result["path"], out_path)
        elif result["url"]:
            source_url = result["url"]
            if source_url.startswith("/"):
                source_url = f"{_common.CANVAS_BASE}{source_url}"
            with open(out_path, "wb") as fh:
                fh.write(_common.download_url(source_url))
        result["path"] = out_path

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="导出拼接视频")
    parser.add_argument("project_id")
    parser.add_argument("--output", "-o", default="", help="输出文件路径")
    parser.add_argument(
        "--aspect",
        "-a",
        default="origin",
        choices=list(PRESETS.keys()),
        help=f"视频尺寸预设: {', '.join(PRESETS.keys())}",
    )
    args = parser.parse_args()

    result = export(args.project_id, args.output, args.aspect)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        sys.exit(1)
