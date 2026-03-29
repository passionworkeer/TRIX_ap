"""TRIX Canvas 完整工作流 — Agent 调用一个脚本即完成全部工作"""

import argparse
import json
import os
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
sys.path.insert(0, os.path.join(SCRIPT_DIR, "adapters"))

import _common
from check_env import check_all
from trix_adapter import TRIXAdapter


def parse_script_text(script_text: str) -> list:
    """解析剧本（AI 辅助 or 按行拆分）"""
    from parse_script import parse_script
    return parse_script(script_text)


def run_workflow(
    script_text: str,
    project_name: str = "",
    concurrent: int = 3,
    skip_video: bool = False,
    skip_subtitle: bool = False,
    batch: int = 1,
    aspect: str = "origin",
):
    """
    执行完整工作流。

    Args:
        script_text: 剧本文本或 .txt 文件路径
        project_name: 项目名称
        concurrent: 并发生成数量（每个镜头的 AI 请求并发数）
        skip_video: 跳过视频生成
        skip_subtitle: 跳过字幕导出
        batch: 批量生成次数（每次生成一套完整的分镜）
        aspect: 视频尺寸预设 (9:16 / 16:9 / 1:1 / 4:3 / origin)
    """
    # ---------- 1. 环境检查 ----------
    print("[1/8] Checking environment...")
    errors = check_all()
    if errors:
        for err in errors:
            print(f"  [ERROR] {err}")
        sys.exit(1)
    print("  [OK] Environment ready")

    # ---------- 2. 解析剧本 ----------
    print(f"\n[2/8] Parsing script...")
    scenes = parse_script_text(script_text)
    print(f"  [OK] Parsed: {len(scenes)} scenes, batch={batch}")

    # ---------- 批量循环 ----------
    all_project_ids = []

    for batch_idx in range(batch):
        batch_name = f"{project_name or 'Short Drama'}#{batch_idx + 1}" if batch > 1 else (project_name or "Short Drama")
        print(f"\n{'=' * 50}")
        print(f"[BATCH {batch_idx + 1}/{batch}] {batch_name}")
        print(f"{'=' * 50}")

        # 3. 创建项目
        print(f"\n[3/8] Creating project: {batch_name}")
        project = _common.create_project(batch_name, script_text)
        project_id = project["id"]
        print(f"  [OK] Project created: {project.get('name')} (id={project_id})")
        all_project_ids.append(project_id)

        # 4. 并发生成图片
        image_results = {}  # scene_index -> {"bytes", "mime"}
        has_ai_api = bool(_common.AI_API_BASE)

        if has_ai_api:
            print(f"\n[4/8] Generating images (concurrent={concurrent})...")
            adapter = TRIXAdapter(_common.AI_API_BASE, _common.AI_API_KEY)

            def gen_image(scene):
                idx = scene.get("index", 0)
                text = scene.get("text", "")
                result = adapter.generate(text, media_type="image")
                return idx, text, result

            with ThreadPoolExecutor(max_workers=concurrent) as pool:
                futures = {pool.submit(gen_image, s): s for s in scenes}
                for i, future in enumerate(as_completed(futures), 1):
                    idx, text, result = future.result()
                    if result["ok"]:
                        image_results[idx] = result
                        print(f"  [OK] [{i}/{len(scenes)}] Scene {idx} generated")
                    else:
                        print(f"  [FAIL] [{i}/{len(scenes)}] Scene {idx}: {result.get('error')}")
        else:
            print(f"\n[4/8] Skipping image generation (AI API not configured)")

        # 5. 创建节点 + 建连线
        print(f"\n[5/8] Creating nodes...")
        node_ids = {}  # scene_index -> node_id
        prev_node_id = None

        for scene in sorted(scenes, key=lambda s: s.get("index", 0)):
            idx = scene.get("index", 0)
            text = scene.get("text", "")
            file_id = None
            status = "pending"

            if idx in image_results:
                result = image_results[idx]
                ext = "png"
                mime = result.get("mime", "image/png")
                if "jpeg" in mime:
                    ext = "jpg"

                with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                    tmp.write(result["bytes"])
                    tmp_path = tmp.name

                try:
                    file_info = _common.upload_file(
                        project_id=project_id,
                        file_data=result["bytes"],
                        filename=f"scene_{idx}.{ext}",
                        mime_type=mime,
                        media_type="image",
                        prompt=text,
                        scene_id=idx,
                    )
                    file_id = file_info.get("id")
                    status = "done"
                finally:
                    os.unlink(tmp_path)

            x = (idx - 1) * 300
            y = 100 + ((idx - 1) % 2) * 80
            node = _common.create_node(
                project_id=project_id,
                file_id=file_id,
                scene_id=idx,
                media_type="image",
                x=x, y=y,
                prompt=text,
                status=status,
            )
            node_ids[idx] = node["id"]

            if prev_node_id:
                _common.create_edge(project_id, prev_node_id, node["id"], "scene_order")
            prev_node_id = node["id"]

            print(f"  [OK] Scene {idx} -> Node {node['id']} (status={status})")

        # 6. 生成视频（可选）
        if not skip_video:
            print(f"\n[6/8] Generating videos...")
            for scene in sorted(scenes, key=lambda s: s.get("index", 0)):
                idx = scene.get("index", 0)
                if idx not in image_results:
                    continue

                text = scene.get("text", "")
                video_prompt = f"Convert to short video: {text}"
                result = adapter.generate(video_prompt, media_type="video")

                if not result["ok"]:
                    print(f"  [FAIL] Scene {idx} video: {result.get('error')}")
                    continue

                with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                    tmp.write(result["bytes"])
                    tmp_path = tmp.name

                try:
                    file_info = _common.upload_file(
                        project_id=project_id,
                        file_data=result["bytes"],
                        filename=f"scene_{idx}.mp4",
                        mime_type="video/mp4",
                        media_type="video",
                        prompt=text,
                        scene_id=idx,
                    )
                    file_id = file_info.get("id")
                finally:
                    os.unlink(tmp_path)

                x = (idx - 1) * 300
                y = 300 + ((idx - 1) % 2) * 80
                video_node = _common.create_node(
                    project_id=project_id,
                    file_id=file_id,
                    scene_id=idx,
                    media_type="video",
                    x=x, y=y,
                    prompt=text,
                    status="done",
                )

                if idx in node_ids:
                    _common.create_edge(
                        project_id, node_ids[idx], video_node["id"], "image_to_video"
                    )

                print(f"  [OK] Scene {idx} video -> Node {video_node['id']}")
        else:
            print(f"\n[6/8] Skipping video generation")

        # 7. 导出字幕（可选）
        if not skip_subtitle:
            print(f"\n[7/8] Exporting subtitles...")
            from export_subtitle import export as export_sub
            result = export_sub(project_id)
            if result["ok"]:
                print(f"  [OK] SRT: {result['srt']}")
                print(f"  [OK] Script: {result['script']}")
        else:
            print(f"\n[7/8] Skipping subtitle export")

    # ---------- 8. 完成 ----------
    print(f"\n{'=' * 50}")
    print(f"[DONE] Workflow complete!")
    print(f"  Projects: {len(all_project_ids)}")
    for pid in all_project_ids:
        print(f"  - Canvas: http://localhost:8789/canvas?projectId={pid}")
    print(f"{'=' * 50}")

    return {
        "ok": True,
        "projects": all_project_ids,
        "scenes_per_project": len(scenes),
        "batch": batch,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TRIX Canvas Workflow (增强版)")
    parser.add_argument("script", help="Script text or .txt file path")
    parser.add_argument("--project-name", default="", help="Project name")
    parser.add_argument("--concurrent", type=int, default=3, help="AI request concurrency")
    parser.add_argument("--skip-video", action="store_true", help="Skip video generation")
    parser.add_argument("--skip-subtitle", action="store_true", help="Skip subtitle export")
    parser.add_argument(
        "--batch", type=int, default=1,
        help="Number of batches to generate (default: 1, use 2-3 for multiple versions)",
    )
    parser.add_argument(
        "--aspect", default="origin",
        choices=["9:16", "16:9", "1:1", "4:3", "origin"],
        help="Video aspect ratio for export",
    )
    args = parser.parse_args()

    if os.path.isfile(args.script):
        with open(args.script, "r", encoding="utf-8") as f:
            script_text = f.read()
    else:
        script_text = args.script

    result = run_workflow(
        script_text,
        project_name=args.project_name,
        concurrent=args.concurrent,
        skip_video=args.skip_video,
        skip_subtitle=args.skip_subtitle,
        batch=args.batch,
        aspect=args.aspect,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
