"""Pydantic 请求/响应模型"""

from typing import Optional, Literal
from pydantic import BaseModel, Field


# ---------- Project ----------


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    script_text: str = ""


class ProjectResponse(BaseModel):
    id: int
    name: str
    script_text: str
    created_at: str
    updated_at: str


class ProjectDetail(ProjectResponse):
    nodes: list["NodeResponse"] = []
    edges: list["EdgeResponse"] = []


# ---------- File ----------


class FileCreate(BaseModel):
    filename: str
    mime_type: str
    prompt: str = ""
    scene_id: Optional[int] = None
    media_type: Literal["image", "video"] = "image"


class FileResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    filepath: str
    thumbnail_path: Optional[str] = None
    mime_type: str
    media_type: str
    prompt: str
    scene_id: Optional[int] = None
    created_at: str


class FileUpdate(BaseModel):
    filename: Optional[str] = None
    prompt: Optional[str] = None


# ---------- Node ----------


class NodeCreate(BaseModel):
    project_id: int
    file_id: Optional[int] = None
    scene_id: Optional[int] = None
    media_type: Literal["image", "video"] = "image"
    x: float = 0
    y: float = 0
    prompt: str = ""
    status: Literal["pending", "generating", "done", "failed"] = "pending"
    task_id: Optional[str] = None


class NodeResponse(BaseModel):
    id: int
    project_id: int
    file_id: Optional[int] = None
    scene_id: Optional[int] = None
    media_type: str
    x: float
    y: float
    prompt: str
    status: str
    task_id: Optional[str] = None
    error_msg: Optional[str] = None
    retry_count: int = 0
    created_at: str


class NodeUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    prompt: Optional[str] = None
    status: Optional[str] = None
    task_id: Optional[str] = None
    error_msg: Optional[str] = None


class NodeRegenerate(BaseModel):
    file_id: Optional[int] = None
    task_id: Optional[str] = None


# ---------- Edge ----------


class EdgeCreate(BaseModel):
    project_id: int
    source_node_id: int
    target_node_id: int
    edge_type: Literal["scene_order", "image_to_video", "reference"] = "scene_order"


class EdgeResponse(BaseModel):
    id: int
    project_id: int
    source_node_id: int
    target_node_id: int
    edge_type: str
    created_at: str


# 解析前向引用
ProjectDetail.model_rebuild()
