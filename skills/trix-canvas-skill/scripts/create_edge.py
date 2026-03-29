"""创建连线（封装 Canvas API）"""

import argparse
import json

import _common


def run(
    project_id: int, source_id: int, target_id: int, edge_type: str = "scene_order"
) -> dict:
    return _common.create_edge(project_id, source_id, target_id, edge_type)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="创建 Canvas 连线")
    parser.add_argument("project_id", type=int)
    parser.add_argument("source_id", type=int)
    parser.add_argument("target_id", type=int)
    parser.add_argument(
        "--type",
        dest="edge_type",
        default="scene_order",
        choices=["scene_order", "image_to_video", "reference"],
    )
    args = parser.parse_args()

    result = run(args.project_id, args.source_id, args.target_id, args.edge_type)
    print(json.dumps(result, ensure_ascii=False, indent=2))
