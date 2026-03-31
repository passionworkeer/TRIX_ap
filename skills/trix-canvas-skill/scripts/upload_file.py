"""上传文件到 Canvas 服务并返回文件元数据"""

from __future__ import annotations

import argparse
import json
import os
import sys

import _common


def run(
    project_id: str,
    file_path: str,
    media_type: str = "image",
    prompt: str = "",
    scene_id: int | None = None,
    node_id: str | None = None,
) -> dict:
    if not os.path.isfile(file_path):
        return {"ok": False, "error": f"文件不存在: {file_path}"}

    mime_map = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
    }
    ext = os.path.splitext(file_path)[1].lower()
    mime_type = mime_map.get(ext, "application/octet-stream")

    with open(file_path, "rb") as fh:
        payload = _common.upload_file(
            project_id=project_id,
            file_data=fh.read(),
            filename=os.path.basename(file_path),
            mime_type=mime_type,
            media_type=media_type,
            prompt=prompt,
            scene_id=scene_id,
            node_id=node_id,
        )

    return {"ok": True, **payload}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="上传图片/视频到 Canvas 项目")
    parser.add_argument("project_id", help="目标项目 ID")
    parser.add_argument("file", help="本地文件路径")
    parser.add_argument("--type", choices=["image", "video"], default="image", help="媒体类型")
    parser.add_argument("--prompt", default="", help="提示词或描述")
    parser.add_argument("--scene-id", type=int, default=None, help="关联的镜头编号")
    parser.add_argument("--node-id", default=None, help="关联的节点 ID")
    args = parser.parse_args()

    result = run(args.project_id, args.file, args.type, args.prompt, args.scene_id, args.node_id)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result.get("ok", True):
        sys.exit(1)
