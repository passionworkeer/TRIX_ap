"""一键启动 Canvas 服务（带自检）"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import webbrowser
from pathlib import Path

from _paths import (
    default_canvas_data_dir,
    default_canvas_export_dir,
    ensure_canvas_node_runtime,
    resolve_canvas_service_dir,
)


def default_base_url(host: str, port: int | str) -> str:
    public_host = (host or "").strip() or "127.0.0.1"
    if public_host in {"0.0.0.0", "::"}:
        public_host = "127.0.0.1"
    if ":" in public_host and not public_host.startswith("["):
        public_host = f"[{public_host}]"
    return f"http://{public_host}:{port}"


def start(
    port: int = 8789,
    host: str = "127.0.0.1",
    base_url: str | None = None,
    open_browser: bool = False,
    with_proxy: bool = False,
):
    from check_env import check_all

    env = os.environ.copy()
    effective_port = int(str(env.get("CANVAS_PORT", port)).strip() or port)
    errors = check_all(effective_port, require_ffmpeg=False)
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

    effective_host = env.get("CANVAS_HOST", "").strip() or host
    effective_port = str(effective_port)
    effective_base_url = (
        env.get("CANVAS_BASE_URL", "").strip()
        or (base_url or "").strip()
        or default_base_url(effective_host, effective_port)
    )
    env["CANVAS_HOST"] = effective_host
    env["CANVAS_PORT"] = effective_port
    env["CANVAS_BASE_URL"] = effective_base_url
    env.setdefault("CANVAS_DATA_DIR", str(default_canvas_data_dir()))
    env.setdefault("CANVAS_EXPORT_DIR", str(default_canvas_export_dir()))
    env.setdefault("CANVAS_AUTH_TOKEN_FILE", str(Path(env["CANVAS_DATA_DIR"]) / ".canvas-access-token"))
    env.setdefault("PROXY_HOST", "127.0.0.1")
    command = ["node", "start-all.js" if with_proxy else "server.js"]

    print(f"🚀 启动 Canvas 服务: {env['CANVAS_BASE_URL']}")
    if with_proxy:
        print("   模式: proxy + canvas")
    else:
        print("   模式: canvas only")
    if env.get("CANVAS_REQUIRE_AUTH", "").lower() in {"1", "true", "yes"}:
        print("   鉴权: enabled（浏览器首次访问会提示输入 CANVAS_ACCESS_TOKEN）")
        if not env.get("CANVAS_ACCESS_TOKEN", "").strip():
            print(f"   Token file: {env['CANVAS_AUTH_TOKEN_FILE']}")

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
    parser.add_argument("--base-url", default="", help="可选：手动指定浏览器访问地址")
    parser.add_argument("--open", action="store_true", help="自动打开浏览器")
    parser.add_argument(
        "--with-proxy",
        action="store_true",
        help="同时启动本地 proxy（等价于 node start-all.js）",
    )
    args = parser.parse_args()

    start(args.port, args.host, args.base_url or None, args.open, args.with_proxy)
