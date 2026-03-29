"""创建节点（封装 Canvas API）"""

import argparse
import json
import sys

import _common


def run(
    project_id: int,
    file_id: int = None,
    scene_id: int = None,
    media_type: str = "image",
    x: float = 0,
    y: float = 0,
    prompt: str = "",
    status: str = "done",
) -> dict:
    return _common.create_node(
        project_id=project_id,
        file_id=file_id,
        scene_id=scene_id,
        media_type=media_type,
        x=x,
        y=y,
        prompt=prompt,
        status=status,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="创建 Canvas 节点")
    parser.add_argument("project_id", type=int)
    parser.add_argument("--file-id", type=int, default=None)
    parser.add_argument("--scene-id", type=int, default=None)
    parser.add_argument("--type", choices=["image", "video"], default="image")
    parser.add_argument("--x", type=float, default=0)
    parser.add_argument("--y", type=float, default=0)
    parser.add_argument("--prompt", default="")
    parser.add_argument("--status", default="done")
    args = parser.parse_args()

    result = run(
        args.project_id,
        args.file_id,
        args.scene_id,
        args.type,
        args.x,
        args.y,
        args.prompt,
        args.status,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
