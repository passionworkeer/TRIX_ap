"""上传生成结果到 Canvas 服务"""

import argparse
import json
import os
import sys

import _common


def upload(
    project_id: int,
    file_path: str,
    media_type: str = "image",
    prompt: str = "",
    scene_id: int = None,
) -> dict:
    """上传文件到 Canvas，返回 file 信息"""
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

    with open(file_path, "rb") as f:
        file_data = f.read()

    filename = os.path.basename(file_path)
    result = _common.upload_file(
        project_id=project_id,
        file_data=file_data,
        filename=filename,
        mime_type=mime_type,
        media_type=media_type,
        prompt=prompt,
        scene_id=scene_id,
    )
    return {"ok": True, **result}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="上传文件到 Canvas")
    parser.add_argument("project_id", type=int, help="项目 ID")
    parser.add_argument("file", help="文件路径")
    parser.add_argument("--type", choices=["image", "video"], default="image")
    parser.add_argument("--prompt", default="")
    parser.add_argument("--scene-id", type=int, default=None)
    args = parser.parse_args()

    result = upload(args.project_id, args.file, args.type, args.prompt, args.scene_id)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result.get("ok", True):
        sys.exit(1)
