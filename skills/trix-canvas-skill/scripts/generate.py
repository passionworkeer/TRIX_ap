"""生成图片/视频：合并 image/video，共用 Adapter"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "adapters"))
from trix_adapter import TRIXAdapter

import _common


def _default_extension(media_type: str, mime: str) -> str:
    mapping = {
        "image/png": "png",
        "image/jpeg": "jpeg",
        "image/webp": "webp",
        "image/gif": "gif",
        "video/mp4": "mp4",
        "video/quicktime": "mov",
    }
    return mapping.get(mime, "png" if media_type == "image" else "mp4")


def _resolve_output_path(output: str, media_type: str, mime: str) -> str:
    extension = _default_extension(media_type, mime)
    if output:
        root, suffix = os.path.splitext(output)
        return output if suffix else f"{root or output}.{extension}"
    return f"output_{media_type}.{extension}"


def generate(prompt: str, media_type: str = "image", output: str = "") -> dict:
    """
    调用 AI 生成图片或视频。
    返回: { "ok": True, "path": "输出文件路径" } 或 { "ok": False, "error": "..." }
    """
    adapter = TRIXAdapter(_common.CANVAS_BASE, _common.get_canvas_access_token())
    result = adapter.generate(prompt, media_type=media_type)

    if not result["ok"]:
        return result

    out_path = _resolve_output_path(output, media_type, result["mime"])

    with open(out_path, "wb") as f:
        f.write(result["bytes"])

    return {"ok": True, "path": out_path, "mime": result["mime"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI 生成图片/视频")
    parser.add_argument("prompt", help="生成提示词")
    parser.add_argument(
        "--type", choices=["image", "video"], default="image", help="生成类型"
    )
    parser.add_argument("--output", "-o", default="", help="输出文件路径")
    args = parser.parse_args()

    result = generate(args.prompt, args.type, args.output)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        sys.exit(1)
