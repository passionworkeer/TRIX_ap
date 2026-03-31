"""切换/创建新的 Canvas 项目（OpenClaw /project 切换语义）"""

import json
import sys

import _common


def run() -> dict:
    resp = _common.change_project()
    if not isinstance(resp, dict):
        raise RuntimeError("Unexpected change project response")
    if resp.get("error"):
        raise RuntimeError(resp["error"])
    return resp.get("data", resp)


if __name__ == "__main__":
    try:
        data = run()
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), ensure_ascii=False)
        sys.exit(1)
