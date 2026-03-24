#!/usr/bin/env python3
"""查询会话进度 / 轮询生成状态：GET /api/session/:sessionId"""

import argparse
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from _common import query_session, build_project_url


def main():
    parser = argparse.ArgumentParser(
        description="查询会话消息列表（轮询生成进度）",
        epilog="""
环境变量:
  AI_API_BASE     必填，AI 服务基础地址
  AI_API_KEY      必填，Bearer 鉴权 Token
  CANVAS_BASE_URL 可选，Canvas 服务地址（默认 http://localhost:8789）

示例:
  python3 query_session.py SESSION_ID
  python3 query_session.py SESSION_ID --after-seq 0
  python3 query_session.py SESSION_ID --project-id PROJECT_UUID
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("session_id", help="会话 ID（由 create_session 返回）")
    parser.add_argument(
        "--after-seq",
        type=int,
        default=0,
        help="只返回 seq 大于该值的消息（增量拉取，默认 0）",
    )
    parser.add_argument(
        "--project-id",
        default="",
        help="项目 ID，传入则结果中附带 canvas 画布链接",
    )
    args = parser.parse_args()

    data = query_session(args.session_id, after_seq=args.after_seq)

    out = {
        "sessionId": data.get("sessionId", args.session_id),
        "status": data.get("status", "unknown"),
        "taskId": data.get("taskId") or "",
        "messages": data.get("messages", []),
        "resultUrls": data.get("resultUrls", []),
    }
    if args.project_id:
        out["projectUrl"] = build_project_url(args.project_id)
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
