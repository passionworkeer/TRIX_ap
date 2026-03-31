"""一键启动 Canvas 服务（带自检）"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import webbrowser

from _paths import (
    default_canvas_data_dir,
    default_canvas_export_dir,
    ensure_canvas_node_runtime,
    resolve_canvas_service_dir,
)


def start(
    port: int = 8789,
    host: str = "127.0.0.1",
    open_browser: bool = False,
    with_proxy: bool = False,
):
    from check_env import check_all

    errors = check_all(port, require_ffmpeg=False)
    if errors:
        for err in errors:
            print(f"❌ {err}")
        sys.exit(1)

    try:
        canvas_service_dir = resolve_canvas_service_dir()
    except FileNotFoundError as exc:
        print(f"❌ {exc}")
        sys.exit(1)

    try:
        ensure_canvas_node_runtime(canvas_service_dir)
    except Exception as exc:  # noqa: BLE001
        print(f"❌ 安装 Canvas 依赖失败: {exc}")
        sys.exit(1)

    env = os.environ.copy()
    env["CANVAS_PORT"] = str(port)
    env["CANVAS_BASE_URL"] = f"http://{host}:{port}"
    env.setdefault("CANVAS_DATA_DIR", str(default_canvas_data_dir()))
    env.setdefault("CANVAS_EXPORT_DIR", str(default_canvas_export_dir()))
    command = ["node", "start-all.js" if with_proxy else "server.js"]

    print(f"🚀 启动 Canvas 服务: {env['CANVAS_BASE_URL']}")
    if with_proxy:
        print("   模式: proxy + canvas")
    else:
        print("   模式: canvas only")

    proc = subprocess.Popen(
        command,
        cwd=str(canvas_service_dir),
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

    if open_browser:
        webbrowser.open(f"{env['CANVAS_BASE_URL']}/canvas")

    proc.wait()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="启动 TRIX Canvas 服务")
    parser.add_argument("--port", type=int, default=8789)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--open", action="store_true", help="自动打开浏览器")
    parser.add_argument(
        "--with-proxy",
        action="store_true",
        help="同时启动本地 proxy（等价于 node start-all.js）",
    )
    args = parser.parse_args()

    start(args.port, args.host, args.open, args.with_proxy)
