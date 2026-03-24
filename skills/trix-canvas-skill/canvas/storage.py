"""文件存储：将上传的文件保存到 ~/.trix-canvas/"""
import os
import uuid
import shutil
from pathlib import Path

CANVAS_DIR = Path.home() / ".trix-canvas"
PROJECTS_DIR = CANVAS_DIR / "projects"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


def get_project_dir(project_id: int) -> Path:
    d = PROJECTS_DIR / str(project_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_uploaded_file(project_id: int, file_data: bytes,
                       filename: str, mime_type: str) -> tuple[str, str]:
    """
    保存上传文件，返回 (relative_path, absolute_path)。
    relative_path 存储到数据库，absolute_path 用于读取。
    """
    ext = filename.rsplit(".", 1)[-1] if "." in filename else ""
    unique_name = f"{uuid.uuid4().hex[:8]}_{filename}" if ext else str(uuid.uuid4())
    project_dir = get_project_dir(project_id)
    abs_path = project_dir / unique_name
    abs_path.write_bytes(file_data)
    rel_path = f"projects/{project_id}/{unique_name}"
    return rel_path, str(abs_path)


def delete_project_files(project_id: int):
    """删除项目目录及所有文件"""
    project_dir = get_project_dir(project_id)
    if project_dir.exists():
        shutil.rmtree(project_dir)


def delete_file_by_path(rel_path: str):
    """根据相对路径删除文件"""
    abs_path = CANVAS_DIR / rel_path
    if abs_path.exists():
        abs_path.unlink()


def get_file_path(rel_path: str) -> str:
    return str(CANVAS_DIR / rel_path)


def resolve_path(project_id: int, filename: str) -> str:
    """解析项目目录下的文件路径"""
    return str(get_project_dir(project_id) / filename)
