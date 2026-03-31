"""创建连线（封装 Canvas API）"""

import argparse
import json
import sys

import _common


def run(
    project_id: str,
    source_id: str,
    target_id: str,
    edge_type: str = "scene_order",
) -> dict:
    return _common.create_edge(project_id, source_id, target_id, edge_type)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="创建 Canvas 连线")
    parser.add_argument("project_id")
    parser.add_argument("source_id")
    parser.add_argument("target_id")
    parser.add_argument(
        "--type",
        dest="edge_type",
        default="scene_order",
        choices=["scene_order", "image_to_video", "reference", "story_branch"],
    )
    args = parser.parse_args()

    try:
        result = run(args.project_id, args.source_id, args.target_id, args.edge_type)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)
