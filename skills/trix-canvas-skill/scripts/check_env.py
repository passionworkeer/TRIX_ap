"""环境检查：端口、ffmpeg、目录"""

import socket
import subprocess
import sys
from pathlib import Path


def check_port(port: int = 8789) -> bool:
    """检查端口是否已被占用"""
    sock = socket.socket()
    try:
        return sock.connect_ex(("localhost", port)) == 0
    finally:
        sock.close()


def check_ffmpeg() -> bool:
    """检查 ffmpeg 是否可用"""
    try:
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def ensure_dirs() -> None:
    """确保 Canvas 所需目录存在"""
    canvas_dir = Path.home() / ".trix-canvas"
    (canvas_dir / "projects").mkdir(parents=True, exist_ok=True)
    (canvas_dir / "thumbnails").mkdir(parents=True, exist_ok=True)
    (canvas_dir / "exports").mkdir(parents=True, exist_ok=True)


def check_all() -> list:
    """执行全部检查，返回错误列表"""
    errors = []

    if check_port():
        print("[WARN] Port 8789 in use (Canvas may be running)")

    if not check_ffmpeg():
        errors.append("ffmpeg not found. Install: pip install imageio[ffmpeg]")

    ensure_dirs()

    return errors


if __name__ == "__main__":
    errors = check_all()
    if errors:
        for err in errors:
            print(f"[ERROR] {err}")
        sys.exit(1)
    print("[OK] Environment check passed")
