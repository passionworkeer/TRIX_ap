"""环境检查：端口、ffmpeg、目录"""

from __future__ import annotations

import os
import socket
import subprocess
import sys

from _paths import (
    canvas_service_candidates,
    ensure_canvas_runtime_dirs,
    resolve_canvas_service_dir,
)


def check_port(port: int = 8789) -> bool:
    """检查端口是否已被占用"""
    sock = socket.socket()
    try:
        return sock.connect_ex(("127.0.0.1", port)) == 0
    finally:
        sock.close()


def check_ffmpeg() -> bool:
    """检查 ffmpeg 是否可用"""
    try:
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def check_command(name: str) -> bool:
    try:
        result = subprocess.run([name, "--version"], capture_output=True, timeout=5)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def check_all(port: int = 8789, require_ffmpeg: bool = False) -> list[str]:
    """执行全部检查，返回错误列表"""
    errors = []

    try:
        canvas_service_dir = resolve_canvas_service_dir()
    except FileNotFoundError:
        joined = "\n  ".join(str(path) for path in canvas_service_candidates())
        errors.append(f"Canvas service not found. Checked:\n  {joined}")
        canvas_service_dir = None

    if check_port(port):
        print(f"[WARN] Port {port} in use (Canvas may already be running)")

    if not check_command("node"):
        errors.append("node not found. Install Node.js before using TRIX Canvas.")

    if not check_command("npm"):
        errors.append("npm not found. Install npm before using TRIX Canvas.")

    if not check_ffmpeg():
        message = "ffmpeg not found. Subtitle/video export will be unavailable."
        if require_ffmpeg:
            errors.append(message)
        else:
            print(f"[WARN] {message}")

    if canvas_service_dir and not (canvas_service_dir / "node_modules").exists():
        print("[WARN] Canvas service dependencies not installed yet; they will be installed on first start.")

    ensure_canvas_runtime_dirs()
    return errors


if __name__ == "__main__":
    target_port = int(os.environ.get("CANVAS_PORT", "8789"))
    errors = check_all(target_port)
    if errors:
        for err in errors:
            print(f"[ERROR] {err}")
        sys.exit(1)
    print("[OK] Environment check passed")
