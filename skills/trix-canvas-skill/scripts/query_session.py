"""查询 OpenClaw 会话状态 / 轮询生成进度"""

import argparse
import json
import sys

import _common


def run(session_id: str, after_seq: int = 0) -> dict:
    resp = _common.query_session(session_id, after_seq=after_seq)
    if not isinstance(resp, dict):
        raise RuntimeError("Unexpected session payload")
    if resp.get("error"):
        raise RuntimeError(resp["error"])
    return resp


def _main():
    parser = argparse.ArgumentParser(description="查询 Canvas session 进度")
    parser.add_argument("session_id", help="要查询的 sessionId")
    parser.add_argument("--after-seq", type=int, default=0, help="只获取此序号之后的消息")
    args = parser.parse_args()

    try:
        data = run(args.session_id, after_seq=args.after_seq)
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    _main()
