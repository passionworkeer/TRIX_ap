"""Canvas 服务主入口：FastAPI"""
import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from models import (
    ProjectCreate, ProjectResponse, ProjectDetail,
    FileUpdate, FileResponse as FileResp,
    NodeCreate, NodeResponse, NodeUpdate, NodeRegenerate,
    EdgeCreate, EdgeResponse,
)
from database import (
    create_project, list_projects, get_project, delete_project,
    create_file, get_file, update_file, delete_file, list_project_files,
    create_node, get_node, update_node, delete_node, list_project_nodes,
    create_edge, delete_edge, list_project_edges,
)
from storage import (
    CANVAS_DIR, get_project_dir, save_uploaded_file,
    delete_project_files, delete_file_by_path, get_file_path,
)
from thumbnail import make_thumbnail, extract_video_thumbnail

app = FastAPI(title="TRIX Canvas", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


# ---------- Static Serving ----------

@app.get("/")
async def index():
    return FileResponse(str(BASE_DIR / "templates" / "index.html"))


# ---------- Projects ----------

@app.get("/api/projects", response_model=list[ProjectResponse])
async def api_list_projects():
    return list_projects()


@app.post("/api/projects", response_model=ProjectResponse, status_code=201)
async def api_create_project(body: ProjectCreate):
    project = create_project(body.name, body.script_text)
    return project


@app.get("/api/projects/{project_id}", response_model=ProjectDetail)
async def api_get_project(project_id: int):
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    nodes = list_project_nodes(project_id)
    edges = list_project_edges(project_id)
    files = list_project_files(project_id)
    # 附上文件信息给节点
    file_map = {f["id"]: f for f in files}
    for n in nodes:
        if n["file_id"] and n["file_id"] in file_map:
            n["_file"] = file_map[n["file_id"]]
    return {**project, "nodes": nodes, "edges": edges}


@app.delete("/api/projects/{project_id}")
async def api_delete_project(project_id: int):
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    delete_project(project_id)
    delete_project_files(project_id)
    return {"ok": True}


# ---------- Files (upload) ----------

@app.post("/api/upload", response_model=FileResp)
async def api_upload(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    prompt: str = Form(""),
    scene_id: Optional[int] = Form(None),
    media_type: str = Form("image"),
):
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")

    contents = await file.read()
    rel_path, abs_path = save_uploaded_file(
        project_id, contents, file.filename or "file",
        file.content_type or "application/octet-stream",
    )

    # 生成缩略图
    mime_type = file.content_type or "application/octet-stream"
    thumb_rel = ""
    if mime_type.startswith("image/"):
        thumb_rel = make_thumbnail(abs_path)
    elif mime_type.startswith("video/"):
        thumb_rel = extract_video_thumbnail(abs_path)

    f = create_file(
        project_id=project_id,
        filename=file.filename or "file",
        filepath=rel_path,
        mime_type=mime_type,
        media_type=media_type,
        thumbnail_path=thumb_rel,
        prompt=prompt,
        scene_id=scene_id,
    )
    return f


@app.get("/api/files/{file_id}", response_model=FileResp)
async def api_get_file(file_id: int):
    f = get_file(file_id)
    if not f:
        raise HTTPException(404, "文件不存在")
    return f


@app.patch("/api/files/{file_id}", response_model=FileResp)
async def api_update_file(file_id: int, body: FileUpdate):
    f = update_file(file_id, **{k: v for k, v in body.model_dump().items() if v is not None})
    if not f:
        raise HTTPException(404, "文件不存在")
    return f


@app.delete("/api/files/{file_id}")
async def api_delete_file(file_id: int):
    f = get_file(file_id)
    if not f:
        raise HTTPException(404, "文件不存在")
    if f["filepath"]:
        delete_file_by_path(f["filepath"])
    if f["thumbnail_path"]:
        delete_file_by_path(f["thumbnail_path"])
    delete_file(file_id)
    return {"ok": True}


# ---------- Nodes ----------

@app.post("/api/nodes", response_model=NodeResponse, status_code=201)
async def api_create_node(body: NodeCreate):
    project = get_project(body.project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    node = create_node(
        project_id=body.project_id,
        file_id=body.file_id,
        scene_id=body.scene_id,
        media_type=body.media_type,
        x=body.x, y=body.y,
        prompt=body.prompt,
        status=body.status,
        task_id=body.task_id,
    )
    return node


@app.get("/api/nodes/{node_id}", response_model=NodeResponse)
async def api_get_node(node_id: int):
    n = get_node(node_id)
    if not n:
        raise HTTPException(404, "节点不存在")
    return n


@app.patch("/api/nodes/{node_id}", response_model=NodeResponse)
async def api_update_node(node_id: int, body: NodeUpdate):
    n = update_node(node_id, **{k: v for k, v in body.model_dump().items() if v is not None})
    if not n:
        raise HTTPException(404, "节点不存在")
    return n


@app.delete("/api/nodes/{node_id}")
async def api_delete_node(node_id: int):
    if not get_node(node_id):
        raise HTTPException(404, "节点不存在")
    delete_node(node_id)
    return {"ok": True}


@app.post("/api/nodes/{node_id}/regenerate", response_model=NodeResponse)
async def api_regenerate_node(node_id: int, body: Optional[NodeRegenerate] = None):
    n = get_node(node_id)
    if not n:
        raise HTTPException(404, "节点不存在")
    updates = {"status": "pending", "error_msg": ""}
    if body:
        if body.file_id is not None:
            updates["file_id"] = body.file_id
        if body.task_id is not None:
            updates["task_id"] = body.task_id
    updated = update_node(node_id, **updates)
    return updated


# ---------- Edges ----------

@app.post("/api/edges", response_model=EdgeResponse, status_code=201)
async def api_create_edge(body: EdgeCreate):
    # 验证节点存在
    src = get_node(body.source_node_id)
    tgt = get_node(body.target_node_id)
    if not src or not tgt:
        raise HTTPException(400, "节点不存在")
    edge = create_edge(
        project_id=body.project_id,
        source_node_id=body.source_node_id,
        target_node_id=body.target_node_id,
        edge_type=body.edge_type,
    )
    return edge


@app.delete("/api/edges/{edge_id}")
async def api_delete_edge(edge_id: int):
    delete_edge(edge_id)
    return {"ok": True}


# ---------- Media Serving ----------

@app.get("/media/{path:path}")
async def serve_media(path: str):
    """提供媒体文件访问（图片/视频/缩略图）"""
    full = CANVAS_DIR / path
    if not full.exists():
        raise HTTPException(404, "文件不存在")
    return FileResponse(str(full))


# ---------- Export ----------

@app.get("/api/projects/{project_id}/export/video")
async def api_export_video(project_id: int):
    """用 ffmpeg 按分镜顺序拼接视频片段，返回拼接后的文件路径"""
    import json

    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")

    nodes = list_project_nodes(project_id)
    # 筛选视频节点，按 scene_id 排序
    video_nodes = [n for n in nodes if n["media_type"] == "video"]
    video_nodes.sort(key=lambda x: (x["scene_id"] or 0, x["id"]))

    if not video_nodes:
        raise HTTPException(400, "项目中没有视频节点")

    # 生成 ffmpeg concat 文件
    concat_dir = CANVAS_DIR / "exports" / str(project_id)
    concat_dir.mkdir(parents=True, exist_ok=True)
    concat_file = concat_dir / "concat.txt"
    output_file = concat_dir / "output.mp4"

    with open(concat_file, "w", encoding="utf-8") as f:
        for n in video_nodes:
            if not n["file_id"]:
                continue
            file_info = get_file(n["file_id"])
            if not file_info:
                continue
            abs_path = get_file_path(file_info["filepath"])
            if not os.path.exists(abs_path):
                continue
            # ffmpeg concat 需要绝对路径
            f.write(f"file '{abs_path}'\n")

    if concat_file.stat().st_size == 0:
        raise HTTPException(400, "无有效视频文件可拼接")

    # 执行拼接
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
             "-i", str(concat_file), "-c", "copy", str(output_file)],
            capture_output=True, timeout=300,
        )
    except FileNotFoundError:
        raise HTTPException(500, "ffmpeg 未安装，请运行: pip install imageio[ffmpeg]")
    except subprocess.TimeoutExpired:
        raise HTTPException(500, "视频拼接超时")

    if not output_file.exists():
        raise HTTPException(500, "视频拼接失败")

    return FileResponse(
        str(output_file),
        media_type="video/mp4",
        filename=f"{project['name']}.mp4",
    )


@app.get("/api/projects/{project_id}/export/subtitle")
async def api_export_subtitle(project_id: int):
    """导出 .srt 字幕 + 台词文档"""
    project = get_project(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")

    nodes = list_project_nodes(project_id)
    nodes.sort(key=lambda x: (x.get("scene_id") or 0, x["id"]))

    if not nodes:
        raise HTTPException(400, "项目没有节点")

    export_dir = CANVAS_DIR / "exports" / str(project_id)
    export_dir.mkdir(parents=True, exist_ok=True)

    # 生成 .srt
    srt_path = export_dir / f"{project['name']}.srt"
    with open(srt_path, "w", encoding="utf-8") as f:
        for i, n in enumerate(nodes, 1):
            start = f"00:0{i-1}:00,000"
            end = f"00:0{i}:00,000"
            text = n["prompt"] or f"镜头 {n.get('scene_id', i)}"
            f.write(f"{i}\n{start} --> {end}\n{text}\n\n")

    # 生成台词文档
    script_path = export_dir / f"{project['name']}_script.md"
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(f"# {project['name']}\n\n")
        for i, n in enumerate(nodes, 1):
            scene = n.get("scene_id", i)
            media = "🎬 视频" if n["media_type"] == "video" else "🖼️ 图片"
            f.write(f"## {media} 镜头 {scene}\n{n['prompt'] or '(无描述)'}\n\n")

    return JSONResponse({
        "srt": str(srt_path.relative_to(CANVAS_DIR)),
        "script": str(script_path.relative_to(CANVAS_DIR)),
    })


# ---------- Run ----------

def run(port: int = 8789, host: str = "127.0.0.1"):
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    run()
