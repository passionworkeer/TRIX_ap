"""缩略图生成：使用 Pillow 为图片/视频生成预览"""
import os
from pathlib import Path
from PIL import Image

CANVAS_DIR = Path.home() / ".trix-canvas"


def make_thumbnail(src_path: str, max_size: tuple[int, int] = (300, 300)) -> str:
    """
    为图片生成缩略图，返回相对路径。
    视频暂用占位符（后续可用 ffmpeg 提取首帧）。
    """
    src = Path(src_path)
    if not src.exists():
        return ""

    thumb_dir = CANVAS_DIR / "thumbnails"
    thumb_dir.mkdir(parents=True, exist_ok=True)

    ext = src.suffix.lower()
    # 视频：暂不处理（ffmpeg 提取首帧可选）
    if ext in (".mp4", ".mov", ".avi", ".mkv", ".webm"):
        return ""  # 视频暂无缩略图

    # 图片：Pillow 缩放
    try:
        img = Image.open(src)
        img.thumbnail(max_size, Image.LANCZOS)
        thumb_name = f"{src.stem}_thumb{src.suffix}"
        thumb_path = thumb_dir / thumb_name
        img.save(thumb_path)
        return str(thumb_path.relative_to(CANVAS_DIR))
    except Exception:
        return ""


def extract_video_thumbnail(src_path: str) -> str:
    """
    用 ffmpeg 提取视频首帧作为缩略图（需要 ffmpeg 可用）。
    失败时返回空字符串。
    """
    import subprocess
    src = Path(src_path)
    thumb_dir = CANVAS_DIR / "thumbnails"
    thumb_dir.mkdir(parents=True, exist_ok=True)
    thumb_path = thumb_dir / f"{src.stem}_thumb.jpg"

    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", src_path,
             "-vf", "select=eq(n\\,0)",
             "-frames:v", "1", "-q:v", "2",
             str(thumb_path)],
            capture_output=True, timeout=30
        )
        if result.returncode == 0 and thumb_path.exists():
            return str(thumb_path.relative_to(CANVAS_DIR))
    except Exception:
        pass
    return ""
