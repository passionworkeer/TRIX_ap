"""生成图片/视频：合并 image/video，共用 Adapter"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "adapters"))
from trix_adapter import TRIXAdapter

import _common


def generate(prompt: str, media_type: str = "image", output: str = "") -> dict:
    """
    调用 AI 生成图片或视频。
    返回: { "ok": True, "path": "输出文件路径" } 或 { "ok": False, "error": "..." }
    """
    adapter = TRIXAdapter(_common.AI_API_BASE, _common.AI_API_KEY)
    result = adapter.generate(prompt, media_type=media_type)

    if not result["ok"]:
        return result

    # 保存到文件
    ext = "png" if media_type == "image" else "mp4"
    if output:
        out_path = output
    else:
        out_path = f"output_{media_type}.{ext}"

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
