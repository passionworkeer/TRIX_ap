"""一键启动 Canvas 服务（带自检）"""

import argparse
import os
import subprocess
import sys
import webbrowser
from pathlib import Path

# 将 canvas 目录加入 path
SCRIPT_DIR = Path(__file__).parent
CANVAS_DIR = SCRIPT_DIR.parent / "canvas"
sys.path.insert(0, str(CANVAS_DIR))

from check_env import check_all


def start(port: int = 8789, host: str = "127.0.0.1", open_browser: bool = False):
    errors = check_all()
    if errors:
        for err in errors:
            print(f"❌ {err}")
        sys.exit(1)

    print(f"🚀 启动 Canvas 服务: http://{host}:{port}")

    if open_browser:
        webbrowser.open(f"http://{host}:{port}")

    # 启动 uvicorn
    os.chdir(str(CANVAS_DIR))
    from canvas_server import run

    run(port=port, host=host)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="启动 TRIX Canvas 服务")
    parser.add_argument("--port", type=int, default=8789)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--open", action="store_true", help="自动打开浏览器")
    args = parser.parse_args()

    start(args.port, args.host, args.open)
