#!/usr/bin/env python3
"""
TRIX Canvas 短剧完整工作流 — Agent 调用一个脚本即完成全部工作。

流程：
  1. 收集需求（角色 + 分镜）
  2. 生成角色参考图（存为 Canvas 节点）
  3. 为每个镜头生成首帧 + 尾帧（引用角色图，确保主体一致）
  4. 首帧节点作为 i2v 父节点生成 VEO 视频
  5. 拼接视频 + 导出字幕
  6. 全部渲染到 Canvas 并连线

用法：
  python3 drama_workflow.py --requirements '{"project":"My Drama",...}'
  python3 drama_workflow.py --requirements-file story.json
  python3 drama_workflow.py --ask   # 交互式询问需求
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR))

import _common
from check_env import check_all


# ── 数据模型 ──────────────────────────────────────────────────────────────────

@dataclass
class Character:
    name: str           # 角色名称（唯一标识）
    appearance: str      # 外观描述（用于生成参考图）
    personality: str = ""  # 个性描述（可选）

    def to_prompt(self, for_image: bool = True) -> str:
        """生成角色描述提示词。"""
        parts = [self.appearance]
        if self.personality:
            parts.append(f"个性：{self.personality}")
        return "。".join(parts)


@dataclass
class Shot:
    shot_number: int          # 镜头序号（从 1 开始）
    description: str          # 镜头描述（分镜文本）
    characters: list[str] = field(default_factory=list)  # 出现的角色名称列表
    shot_type: str = "normal"  # normal / wide / closeup / action / transition

    def characters_refs(self, characters: list[Character]) -> list[Character]:
        """返回本镜头涉及的角色对象列表。"""
        return [c for c in characters if c.name in self.characters]


@dataclass
class DramaRequirements:
    project: str                      # 项目名称
    aspect: str = "9:16"              # 宽高比（默认竖版短视频）
    thinking_mode: str = "high"        # 思维模式
    image_size: str = "2K"            # 分辨率
    characters: list[Character] = field(default_factory=list)
    shots: list[Shot] = field(default_factory=list)
    style: str = ""                   # 整体风格描述

    @classmethod
    def from_dict(cls, data: dict) -> "DramaRequirements":
        characters = [Character(**c) if isinstance(c, dict) else c
                      for c in data.get("characters", [])]
        shots = [Shot(**s) if isinstance(s, dict) else s
                 for s in data.get("shots", [])]
        return cls(
            project=data.get("project", "Short Drama"),
            aspect=data.get("aspect", "9:16"),
            thinking_mode=data.get("thinking_mode", "high"),
            image_size=data.get("image_size", "2K"),
            characters=characters,
            shots=shots,
            style=data.get("style", ""),
        )

    def to_prompt_suffix(self) -> str:
        """生成附加风格提示词。"""
        parts = []
        if self.style:
            parts.append(f"整体风格：{self.style}")
        char_names = [c.name for c in self.characters]
        if char_names:
            parts.append(f"角色：{', '.join(char_names)}")
        return "；".join(parts) if parts else ""


# ── 工具函数 ───────────────────────────────────────────────────────────────────

def _unwrap_payload_data(payload: dict | None) -> dict:
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, dict):
            return data
        return payload
    return {}


def _poll_session(session_id: str, timeout: int = 300) -> dict:
    return _common.wait_for_session(session_id, timeout=timeout, poll_interval=3)


def _resolve_aspect(aspect: str, media_type: str) -> str:
    """解析 aspect 别名。"""
    mapping = {
        "origin": "1:1",
        "portrait": "9:16",
        "landscape": "16:9",
        "square": "1:1",
    }
    if aspect in mapping:
        return mapping[aspect]
    return aspect


def _load_requirements(source: str) -> DramaRequirements:
    """从 JSON 字符串或文件加载需求。"""
    path = Path(source)
    if path.exists() and path.is_file():
        data = json.loads(path.read_text(encoding="utf-8"))
    else:
        data = json.loads(source)
    return DramaRequirements.from_dict(data)


def _ask_requirements_interactive() -> DramaRequirements:
    """交互式询问需求。"""
    print("\n=== 短剧需求收集 ===")

    project = input("项目名称: ").strip() or "Short Drama"

    aspect_raw = input("宽高比 [9:16 竖版 / 16:9 横版 / 21:9 超宽] (默认 9:16): ").strip() or "9:16"
    aspect = {"竖": "9:16", "横": "16:9", "超宽": "21:9"}.get(aspect_raw, "9:16")

    size_raw = input("分辨率 [512 / 1K / 2K / 4K] (默认 2K): ").strip() or "2K"
    image_size = size_raw if size_raw in {"512", "1K", "2K", "4K"} else "2K"

    mode_raw = input("思维模式 [minimal 快速 / high 深度] (默认 high): ").strip() or "high"
    thinking_mode = mode_raw if mode_raw in {"minimal", "high"} else "high"

    style = input("整体风格描述（可选，回车跳过）: ").strip()

    print("\n--- 角色定义（回车结束）---")
    characters = []
    while True:
        name = input("角色名称（回车结束角色输入）: ").strip()
        if not name:
            break
        appearance = input(f"  {name} 外观描述: ").strip()
        if not appearance:
            print("  外观描述不能为空，跳过该角色")
            continue
        personality = input(f"  {name} 个性描述（可选，回车跳过）: ").strip()
        characters.append(Character(name=name, appearance=appearance, personality=personality))

    print("\n--- 分镜定义（回车结束）---")
    print("格式：描述文本 [, 角色1,角色2,...] [, 类型]")
    print("类型：normal/wide/closeup/action/transition")
    shots = []
    shot_number = 1
    while True:
        line = input(f"镜头 {shot_number}（回车结束分镜输入）: ").strip()
        if not line:
            break
        parts = [p.strip() for p in line.split(",")]
        description = parts[0]
        chars = []
        shot_type = "normal"
        for part in parts[1:]:
            if part.lower() in {"normal", "wide", "closeup", "action", "transition"}:
                shot_type = part.lower()
            elif part.strip():
                chars.extend([c.strip() for c in part.split("/") if c.strip()])
        shots.append(Shot(shot_number=shot_number, description=description,
                           characters=chars, shot_type=shot_type))
        shot_number += 1

    return DramaRequirements(
        project=project,
        aspect=aspect,
        thinking_mode=thinking_mode,
        image_size=image_size,
        characters=characters,
        shots=shots,
        style=style,
    )


# ── Canvas 操作封装 ────────────────────────────────────────────────────────────

def _canvas_node(project_id: str, media_type: str, prompt: str,
                 parent_node_id: str | None = None,
                 result_url: str | None = None,
                 x: float = 0, y: float = 0,
                 status: str = "done") -> dict:
    """创建 Canvas 节点。"""
    return _common.create_node(
        project_id=project_id,
        media_type=media_type,
        prompt=prompt,
        parent_node_id=parent_node_id,
        result_url=result_url,
        x=x, y=y,
        status=status,
    )


def _canvas_edge(project_id: str, source: str, target: str, edge_type: str = "scene_order") -> dict:
    """创建 Canvas 边。"""
    return _common.create_edge(project_id, source, target, edge_type)


# ── 核心阶段 ───────────────────────────────────────────────────────────────────

def _phase_create_project(req: DramaRequirements) -> tuple[str, dict]:
    """创建 Canvas 项目。"""
    print(f"\n[1/6] 创建项目: {req.project}")
    project = _unwrap_payload_data(_common.create_project(req.project, json.dumps(asdict(req))))
    project_id = project.get("id")
    if not project_id:
        raise RuntimeError("project id missing")
    print(f"  [OK] project_id={project_id}")
    return project_id, project


def _phase_generate_characters(
    req: DramaRequirements,
    project_id: str,
) -> list[dict]:
    """
    生成角色参考图节点。
    返回: [{character_name, node_id, session_id, result_url}, ...]
    """
    print(f"\n[2/6] 生成 {len(req.characters)} 个角色参考图...")
    results = []
    prev_node_id = None

    for idx, char in enumerate(req.characters):
        print(f"\n  [{idx+1}/{len(req.characters)}] 生成角色: {char.name}")
        prompt = f"角色参考图：{char.to_prompt()}"

        # 创建会话
        payload = _common.create_session(
            message=prompt,
            project_id=project_id,
            media_type="image",
            aspect=req.aspect,
            thinking_mode=req.thinking_mode,
            image_size=req.image_size,
        )
        data = _unwrap_payload_data(payload)
        session_id = str(data.get("sessionId", ""))
        node_id = str(data.get("nodeId", ""))
        print(f"    session={session_id}  node={node_id}")

        # 轮询结果
        result = _poll_session(session_id)
        status = str(result.get("status", "")).lower()
        result_url = None
        if status == "completed":
            result_url = (result.get("resultUrls") or [None])[0]
            _common.update_node(node_id, status="done", result_url=result_url)
            print(f"    [OK] {char.name} result_url={result_url}")
        else:
            _common.update_node(node_id, status="error",
                                result_url=result.get("error", "unknown"))
            print(f"    [FAIL] {result.get('error', 'unknown')}")

        results.append({
            "character_name": char.name,
            "character": char,
            "node_id": node_id,
            "session_id": session_id,
            "result_url": result_url,
            "status": status,
        })

        # 边：角色参考图 → 场景编排（横排）
        if prev_node_id and node_id:
            _canvas_edge(project_id, prev_node_id, node_id, "character_order")
        prev_node_id = node_id

    ok_count = sum(1 for r in results if r["status"] == "completed")
    print(f"\n  角色图完成: {ok_count}/{len(results)}")
    return results


def _phase_generate_frames(
    req: DramaRequirements,
    project_id: str,
    character_results: list[dict],
) -> list[dict]:
    """
    为每个镜头生成首帧（start_frame）和尾帧（end_frame）节点。
    首帧通过 inputImage 引用角色参考图，确保主体一致。
    返回: [{shot, start_frame_node_id, end_frame_node_id, ...}, ...]
    """
    print(f"\n[3/6] 生成 {len(req.shots)} 个镜头的首帧 + 尾帧...")

    # 构建角色名 → result_url 映射
    char_url_map = {r["character_name"]: r["result_url"] for r in character_results}

    results = []
    prev_shot_end_node = None  # 上一个镜头的尾帧节点（用于连线）

    for shot_idx, shot in enumerate(req.shots):
        print(f"\n  镜头 {shot.shot_number}: {shot.description[:40]}...")

        involved_chars = shot.characters_refs(req.characters)
        char_in_prompt = ", ".join(c.name for c in involved_chars) if involved_chars else ""

        suffix = req.to_prompt_suffix()
        style_hint = f"，镜头类型：{shot.shot_type}，{suffix}" if suffix else f"，镜头类型：{shot.shot_type}"

        # ── 首帧生成（引用角色图 → 主体一致性） ──
        start_prompt = f"首帧：{shot.description}{style_hint}"
        if char_in_prompt:
            start_prompt += f"，角色：{char_in_prompt}"

        # 选择一张角色图作为 inputImage（取该镜头第一个角色）
        input_image = None
        if involved_chars:
            char_name = involved_chars[0].name
            input_image = char_url_map.get(char_name)

        start_payload = _common.create_session(
            message=start_prompt,
            project_id=project_id,
            media_type="image",
            aspect=req.aspect,
            thinking_mode=req.thinking_mode,
            image_size=req.image_size,
            input_image=input_image,
        )
        start_data = _unwrap_payload_data(start_payload)
        start_session_id = str(start_data.get("sessionId", ""))
        start_node_id = str(start_data.get("nodeId", ""))
        print(f"    首帧 session={start_session_id}  node={start_node_id}")

        # ── 尾帧生成（不引用 inputImage，作为视频结束画面提示） ──
        end_prompt = f"尾帧（视频结束画面）：{shot.description}{style_hint}"
        if char_in_prompt:
            end_prompt += f"，角色：{char_in_prompt}"

        end_payload = _common.create_session(
            message=end_prompt,
            project_id=project_id,
            media_type="image",
            aspect=req.aspect,
            thinking_mode=req.thinking_mode,
            image_size=req.image_size,
        )
        end_data = _unwrap_payload_data(end_payload)
        end_session_id = str(end_data.get("sessionId", ""))
        end_node_id = str(end_data.get("nodeId", ""))
        print(f"    尾帧 session={end_session_id}  node={end_node_id}")

        # 等待两个 session 都完成
        start_result = _poll_session(start_session_id)
        start_status = str(start_result.get("status", "")).lower()
        start_url = None
        if start_status == "completed":
            start_url = (start_result.get("resultUrls") or [None])[0]
            _common.update_node(start_node_id, status="done", result_url=start_url)
            print(f"    首帧 [OK] url={start_url}")
        else:
            _common.update_node(start_node_id, status="error")
            print(f"    首帧 [FAIL] {start_result.get('error', 'unknown')}")

        end_result = _poll_session(end_session_id)
        end_status = str(end_result.get("status", "")).lower()
        end_url = None
        if end_status == "completed":
            end_url = (end_result.get("resultUrls") or [None])[0]
            _common.update_node(end_node_id, status="done", result_url=end_url)
            print(f"    尾帧 [OK] url={end_url}")
        else:
            _common.update_node(end_node_id, status="error")
            print(f"    尾帧 [FAIL] {end_result.get('error', 'unknown')}")

        # 边连线：角色参考图 → 首帧（如果该镜头有角色）
        if involved_chars and char_url_map:
            ref_char_result = next(
                (r for r in character_results if r["character_name"] == involved_chars[0].name),
                None
            )
            if ref_char_result and ref_char_result["node_id"] and start_node_id:
                _canvas_edge(project_id, ref_char_result["node_id"], start_node_id, "character_to_frame")

        # 边连线：首帧 → 尾帧（同镜头内）
        if start_node_id and end_node_id:
            _canvas_edge(project_id, start_node_id, end_node_id, "shot_frame_order")

        # 边连线：上一镜头尾帧 → 本镜头首帧（跨镜头叙事链）
        if prev_shot_end_node and start_node_id:
            _canvas_edge(project_id, prev_shot_end_node, start_node_id, "scene_order")

        shot_result = {
            "shot": shot,
            "start_frame_node_id": start_node_id,
            "start_frame_session_id": start_session_id,
            "start_frame_url": start_url,
            "start_frame_status": start_status,
            "end_frame_node_id": end_node_id,
            "end_frame_session_id": end_session_id,
            "end_frame_url": end_url,
            "end_frame_status": end_status,
        }
        results.append(shot_result)
        prev_shot_end_node = end_node_id if end_status == "completed" else None

    ok_count = sum(
        1 for r in results
        if r["start_frame_status"] == "completed" and r["end_frame_status"] == "completed"
    )
    print(f"\n  首帧+尾帧完成: {ok_count}/{len(results)}")
    return results


def _phase_generate_videos(
    req: DramaRequirements,
    project_id: str,
    frame_results: list[dict],
) -> list[dict]:
    """
    首帧节点作为 i2v 父节点，生成 VEO 视频。
    返回: [{shot, video_node_id, video_session_id, video_status, ...}, ...]
    """
    print(f"\n[4/6] 生成 {len(frame_results)} 个镜头的视频...")
    results = []
    prev_video_node_id = None

    for idx, frame in enumerate(frame_results):
        shot = frame["shot"]
        start_node_id = frame["start_frame_node_id"]
        start_url = frame["start_frame_url"]
        end_url = frame["end_frame_url"]

        print(f"\n  [{idx+1}/{len(frame_results)}] 镜头 {shot.shot_number}: {shot.description[:40]}...")

        # 如果首帧失败，跳过该视频
        if frame["start_frame_status"] != "completed" or not start_node_id:
            print(f"    [SKIP] 首帧未完成，无法生成视频")
            results.append({
                "shot": shot,
                "video_node_id": "",
                "video_session_id": "",
                "video_status": "skipped",
                "error": "start frame not available",
            })
            continue

        suffix = req.to_prompt_suffix()
        style_hint = f"，{suffix}" if suffix else ""

        # 视频提示词：包含尾帧作为目标画面引导
        end_frame_hint = ""
        if end_url:
            end_frame_hint = f"；视频结尾应逐渐过渡到以下画面：{shot.description}的尾声"

        video_prompt = (
            f"{shot.description}{style_hint}。"
            f"镜头时长 8 秒。"
            f"{end_frame_hint}"
        )
        print(f"    i2v parent={start_node_id}")
        print(f"    prompt={video_prompt[:80]}...")

        # 创建视频会话（parentNodeId 触发 i2v）
        video_payload = _common.create_session(
            message=video_prompt,
            project_id=project_id,
            media_type="video",
            aspect=req.aspect,
            parent_node_id=start_node_id,
        )
        video_data = _unwrap_payload_data(video_payload)
        video_session_id = str(video_data.get("sessionId", ""))
        video_node_id = str(video_data.get("nodeId", ""))
        print(f"    video session={video_session_id}  node={video_node_id}")

        # 轮询视频结果（视频生成可能较长，超时设为 300s）
        video_result = _poll_session(video_session_id, timeout=300)
        video_status = str(video_result.get("status", "")).lower()
        video_url = None
        if video_status == "completed":
            video_url = (video_result.get("resultUrls") or [None])[0]
            _common.update_node(video_node_id, status="done", result_url=video_url)
            print(f"    视频 [OK] url={video_url}")
        else:
            _common.update_node(video_node_id, status="error")
            print(f"    视频 [FAIL] {video_result.get('error', 'unknown')}")

        # 边连线：首帧 → 视频（i2v 关系）
        if start_node_id and video_node_id:
            _canvas_edge(project_id, start_node_id, video_node_id, "frame_to_video")

        # 边连线：上一视频 → 本视频（叙事链）
        if prev_video_node_id and video_node_id:
            _canvas_edge(project_id, prev_video_node_id, video_node_id, "scene_order")

        results.append({
            "shot": shot,
            "video_node_id": video_node_id,
            "video_session_id": video_session_id,
            "video_status": video_status,
            "video_url": video_url,
            "start_frame_node_id": start_node_id,
            "end_frame_node_id": frame["end_frame_node_id"],
        })
        if video_status == "completed":
            prev_video_node_id = video_node_id

    ok_count = sum(1 for r in results if r["video_status"] == "completed")
    print(f"\n  视频生成完成: {ok_count}/{len(results)}")
    return results


def _phase_export(
    req: DramaRequirements,
    project_id: str,
    video_results: list[dict],
) -> dict:
    """导出字幕 + 拼接最终视频。"""
    outputs = {}

    # ── 字幕 ──
    print("\n[5/6] 导出字幕...")
    try:
        subtitle_result = _common.export_subtitle(project_id)
        if subtitle_result.get("ok"):
            print(f"  [OK] SRT: {subtitle_result.get('srt', '')}")
            print(f"  [OK] Script: {subtitle_result.get('script', '')}")
            outputs["subtitle"] = subtitle_result
        else:
            print(f"  [FAIL] {subtitle_result.get('error', 'unknown')}")
            outputs["subtitle"] = subtitle_result
    except Exception as exc:
        print(f"  [FAIL] {exc}")
        outputs["subtitle"] = {"ok": False, "error": str(exc)}

    # ── 拼接视频 ──
    print("\n[6/6] 拼接最终视频...")
    video_ok = [r for r in video_results if r["video_status"] == "completed"]
    if not video_ok:
        print("  [SKIP] 没有可拼接的完成视频")
        outputs["final_video"] = {"ok": False, "error": "no completed videos"}
        return outputs

    try:
        final_result = _common.export_video(project_id, aspect=req.aspect)
        if final_result.get("ok"):
            print(f"  [OK] Final video: {final_result.get('path', '')}")
            outputs["final_video"] = final_result
        else:
            print(f"  [FAIL] {final_result.get('error', 'unknown')}")
            outputs["final_video"] = final_result
    except Exception as exc:
        print(f"  [FAIL] {exc}")
        outputs["final_video"] = {"ok": False, "error": str(exc)}

    return outputs


# ── 主入口 ────────────────────────────────────────────────────────────────────

def run_drama_workflow(
    requirements: DramaRequirements | None = None,
    requirements_source: str | None = None,
    ask_interactive: bool = False,
    concurrent: int = 1,
) -> dict:
    """
    执行完整短剧工作流。

    阶段：
      1. 收集/解析需求
      2. 创建 Canvas 项目
      3. 生成角色参考图节点
      4. 生成每个镜头的首帧 + 尾帧节点（引用角色图确保主体一致）
      5. 首帧节点作为 i2v 父节点生成 VEO 视频
      6. 导出字幕 + 拼接最终视频

    Canvas 节点连线逻辑：
      - 角色参考图节点（横向排列，character_order 边）
      - 角色图 → 首帧（character_to_frame 边，仅该镜头涉及的角色）
      - 首帧 → 尾帧（shot_frame_order 边，同镜头内）
      - 上一镜头尾帧 → 本镜头首帧（scene_order 边，跨镜头叙事链）
      - 首帧 → 视频（frame_to_video 边，i2v 关系）
      - 上一视频 → 本视频（scene_order 边）
    """
    # 1. 环境检查
    print("[0/6] 检查环境...")
    errors = check_all()
    if errors:
        raise RuntimeError("\n".join(errors))
    print("  [OK] 环境就绪")

    # 1.5. 收集需求
    if ask_interactive:
        req = _ask_requirements_interactive()
    elif requirements is not None:
        req = requirements
    elif requirements_source:
        req = _load_requirements(requirements_source)
    else:
        raise ValueError("必须提供 --requirements、--requirements-file 或 --ask")

    print(f"\n[需求确认]")
    print(f"  项目: {req.project}")
    print(f"  宽高比: {req.aspect}")
    print(f"  分辨率: {req.image_size}  思维模式: {req.thinking_mode}")
    if req.style:
        print(f"  风格: {req.style}")
    print(f"  角色 ({len(req.characters)}): {', '.join(c.name for c in req.characters)}")
    print(f"  镜头 ({len(req.shots)}): {', '.join(f'#{s.shot_number}' for s in req.shots)}")

    # 2. 创建项目
    project_id, project = _phase_create_project(req)

    # 3. 生成角色图
    character_results = _phase_generate_characters(req, project_id)

    # 4. 生成首帧 + 尾帧
    frame_results = _phase_generate_frames(req, project_id, character_results)

    # 5. 生成视频
    video_results = _phase_generate_videos(req, project_id, frame_results)

    # 6. 导出
    export_outputs = _phase_export(req, project_id, video_results)

    # 汇总
    canvas_url = (
        f"{os.environ.get('CANVAS_BASE_URL', 'http://localhost:8789')}"
        f"/canvas?projectId={project_id}"
    )

    ok_images = sum(
        1 for r in frame_results
        if r["start_frame_status"] == "completed" and r["end_frame_status"] == "completed"
    )
    ok_videos = sum(1 for r in video_results if r["video_status"] == "completed")

    summary = {
        "ok": ok_videos > 0 and ok_images > 0,
        "project_id": project_id,
        "canvas_url": canvas_url,
        "character_count": len(req.characters),
        "characters": [
            {
                "name": r["character_name"],
                "node_id": r["node_id"],
                "result_url": r["result_url"],
                "status": r["status"],
            }
            for r in character_results
        ],
        "shots": [
            {
                "shot_number": r["shot"].shot_number,
                "description": r["shot"].description,
                "start_frame_node_id": r["start_frame_node_id"],
                "start_frame_status": r["start_frame_status"],
                "end_frame_node_id": r["end_frame_node_id"],
                "end_frame_status": r["end_frame_status"],
                "video_node_id": vr.get("video_node_id", ""),
                "video_status": vr.get("video_status", "skipped"),
                "video_url": vr.get("video_url", ""),
            }
            for r, vr in zip(frame_results, video_results)
        ],
        "subtitle": export_outputs.get("subtitle", {}),
        "final_video": export_outputs.get("final_video", {}),
        "summary": {
            "characters_ok": sum(1 for r in character_results if r["status"] == "completed"),
            "frames_ok": ok_images,
            "videos_ok": ok_videos,
            "total_shots": len(req.shots),
        },
    }

    print(f"\n{'='*60}")
    print(f"  项目: {req.project}")
    print(f"  Canvas: {canvas_url}")
    print(f"  角色图: {summary['summary']['characters_ok']}/{len(req.characters)} 完成")
    print(f"  首尾帧: {ok_images}/{len(req.shots)} 完成")
    print(f"  视频: {ok_videos}/{len(req.shots)} 完成")
    if export_outputs.get("final_video", {}).get("ok"):
        print(f"  最终视频: {export_outputs['final_video'].get('path', '')}")
    if export_outputs.get("subtitle", {}).get("ok"):
        print(f"  字幕: {export_outputs['subtitle'].get('srt', '')}")
    print(f"{'='*60}")

    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TRIX Canvas 短剧完整工作流")
    parser.add_argument(
        "--requirements", "-r",
        help="JSON 格式的短剧需求（字符串或文件路径）",
    )
    parser.add_argument(
        "--requirements-file", "-f",
        dest="requirements_file",
        help="从文件加载短剧需求 JSON",
    )
    parser.add_argument(
        "--ask",
        action="store_true",
        help="交互式询问短剧需求",
    )
    parser.add_argument(
        "--concurrent", "-c",
        type=int, default=1,
        help="并发轮询数（当前固定为 1，保证顺序生成）",
    )
    parser.add_argument(
        "--output",
        "-o",
        help="结果 JSON 输出到文件（默认打印到 stdout）",
    )
    args = parser.parse_args()

    # 优先 --requirements（可能是文件路径）
    req_source = None
    if args.requirements:
        req_source = args.requirements
    elif args.requirements_file:
        req_source = args.requirements_file

    try:
        result = run_drama_workflow(
            requirements_source=req_source,
            ask_interactive=args.ask,
            concurrent=args.concurrent,
        )
        output = json.dumps(result, ensure_ascii=False, indent=2)
        if args.output:
            Path(args.output).write_text(output, encoding="utf-8")
            print(f"结果已写入: {args.output}")
        else:
            print(output)
        if not result.get("ok", False):
            sys.exit(1)
    except Exception as exc:
        err = json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2)
        print(err)
        sys.exit(1)
