"""创建 OpenClaw 会话 / 发送生成指令"""

import argparse
import json
import sys

import _common


def run(message: str, project_id: int | str | None = None, session_id: str | None = None) -> dict:
    """创建新会话或者向已有会话发送指令"""
    resp = _common.create_session(message, project_id=project_id, session_id=session_id)
    if not isinstance(resp, dict):
        raise RuntimeError("Unexpected session response")
    if resp.get("error"):
        raise RuntimeError(resp["error"])
    data = resp.get("data") or resp
    if not data.get("sessionId"):
        raise RuntimeError("sessionId missing from response")
    return data


def _main():
    parser = argparse.ArgumentParser(description="向 Canvas session 提交生成指令")
    parser.add_argument("message", help="用户提示词或生成指令")
    parser.add_argument("--project-id", type=str, help="绑定的项目 ID（可选）")
    parser.add_argument("--session-id", help="复用已有 session（可选）")
    args = parser.parse_args()

    try:
        data = run(args.message, args.project_id, args.session_id)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), ensure_ascii=False)
        sys.exit(1)


if __name__ == "__main__":
    _main()
