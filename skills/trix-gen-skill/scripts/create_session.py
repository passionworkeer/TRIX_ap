#!/usr/bin/env python3
"""创建会话 / 提交生成任务：POST /api/session"""

import argparse
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from _common import create_session, build_project_url


def main():
    parser = argparse.ArgumentParser(
        description="创建会话并提交 AI 生成任务（文生图、文生视频等）",
        epilog="""
环境变量:
  AI_API_BASE       必填，AI 服务基础地址（如 https://api.example.com/v1）
  AI_API_KEY        必填，Bearer 鉴权 Token
  CANVAS_BASE_URL   可选，Canvas 服务地址（默认 http://localhost:8789）

示例:
  python3 create_session.py "生成一张赛博朋克风格城市夜景"
  python3 create_session.py "再生成一张晴天版本" --session-id SESSION_ID
  python3 create_session.py  # 只创建会话，不发消息
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "message",
        nargs="?",
        default="",
        help="生成描述（如「生成一张赛博朋克图片」「做一个跑步动画」）",
    )
    parser.add_argument(
        "--session-id",
        default="",
        help="已有会话 ID，不传则创建新会话",
    )
    args = parser.parse_args()

    data = create_session(session_id=args.session_id or "", message=args.message or "")
    project_uuid = data.get("projectUuid", "")
    session_id = data.get("sessionId", "")
    task_id = data.get("taskId")
    project_url = build_project_url(project_uuid)

    if not session_id:
        print("错误：未返回 sessionId", file=sys.stderr)
        sys.exit(1)

    out = {
        "projectUuid": project_uuid,
        "sessionId": session_id,
        "taskId": task_id or "",
        "projectUrl": project_url,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
