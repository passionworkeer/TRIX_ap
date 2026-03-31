"""TRIX Canvas 完整工作流 — Agent 调用一个脚本即完成全部工作"""

from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

import _common
from check_env import check_all
from parse_script import parse_script


def _unwrap_payload_data(payload: dict | None) -> dict:
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, dict):
            return data
        return payload
    return {}


def _poll_job(job: dict, timeout: int = 300) -> dict:
    payload = _common.wait_for_session(job["session_id"], timeout=timeout, poll_interval=2)
    return {**job, "result": payload}


def _queue_media_sessions(
    project_id: str,
    scenes: list[dict],
    media_type: str,
    aspect: str,
    style: str,
    parent_lookup: dict[int, str] | None = None,
) -> list[dict]:
    jobs = []
    previous_node_id = None
    for scene in scenes:
        if media_type == "video" and parent_lookup:
            parent_node_id = parent_lookup.get(scene["index"])
            if not parent_node_id:
                jobs.append(
                    {
                        "scene_index": scene["index"],
                        "scene_text": scene["text"],
                        "media_type": media_type,
                        "session_id": "",
                        "node_id": "",
                        "status": "error",
                        "error": "missing parent image node",
                    }
                )
                continue
        else:
            parent_node_id = previous_node_id

        try:
            payload = _common.create_session(
                message=scene["text"],
                project_id=project_id,
                media_type=media_type,
                aspect=aspect,
                style=style,
                parent_node_id=parent_node_id,
            )
            data = _unwrap_payload_data(payload)
            job = {
                "scene_index": scene["index"],
                "scene_text": scene["text"],
                "media_type": media_type,
                "session_id": str(data.get("sessionId") or ""),
                "node_id": str(data.get("nodeId") or ""),
                "status": data.get("status", "queued"),
            }
            if not job["session_id"]:
                job["status"] = "error"
                job["error"] = "sessionId missing from response"
        except Exception as exc:  # noqa: BLE001
            job = {
                "scene_index": scene["index"],
                "scene_text": scene["text"],
                "media_type": media_type,
                "session_id": "",
                "node_id": "",
                "status": "error",
                "error": str(exc),
            }
        jobs.append(job)
        if media_type == "image" and job.get("node_id"):
            previous_node_id = job["node_id"]
    return jobs


def _wait_jobs(jobs: list[dict], concurrent: int) -> tuple[list[dict], list[dict]]:
    completed = []
    failed = []
    queued = [job for job in jobs if job.get("session_id")]
    missing = [job for job in jobs if not job.get("session_id")]
    for job in missing:
        error = job.get("error") or "sessionId missing from response"
        failed.append({**job, "result": {"status": "error", "error": error}})
        print(
            f"  [FAIL] [queue] {job['media_type']} scene {job['scene_index']}: {error}"
        )
    if not queued:
        return completed, failed

    with ThreadPoolExecutor(max_workers=max(1, concurrent)) as pool:
        futures = {pool.submit(_poll_job, job): job for job in queued}
        for index, future in enumerate(as_completed(futures), 1):
            job = futures[future]
            try:
                result = future.result()
            except Exception as exc:  # noqa: BLE001
                failed.append(
                    {
                        **job,
                        "result": {"status": "error", "error": str(exc)},
                    }
                )
                print(
                    f"  [FAIL] [{index}/{len(futures)}] {job['media_type']} scene {job['scene_index']}: "
                    f"{exc}"
                )
                continue
            payload = result["result"]
            status = str(payload.get("status", "")).lower()
            if status == "completed":
                completed.append(result)
                print(
                    f"  [OK] [{index}/{len(futures)}] {job['media_type']} scene {job['scene_index']} completed"
                )
            else:
                failed.append(result)
                print(
                    f"  [FAIL] [{index}/{len(futures)}] {job['media_type']} scene {job['scene_index']}: "
                    f"{payload.get('error', 'unknown error')}"
                )
    return completed, failed


def run_workflow(
    script_text: str,
    project_name: str = "",
    concurrent: int = 3,
    skip_video: bool = False,
    skip_subtitle: bool = False,
    batch: int = 1,
    aspect: str = "origin",
    style: str = "",
):
    """
    执行完整工作流。
    """
    print("[1/6] Checking environment...")
    errors = check_all()
    if errors:
        for err in errors:
            print(f"  [ERROR] {err}")
        sys.exit(1)
    print("  [OK] Environment ready")

    print("\n[2/6] Parsing script...")
    scenes = parse_script(script_text)
    if not scenes:
        print("  [ERROR] 没有解析出任何镜头")
        sys.exit(1)
    print(f"  [OK] Parsed {len(scenes)} scenes")

    all_projects = []
    project_summaries = []
    total_image_failures = 0
    total_video_failures = 0
    total_subtitle_failures = 0
    for batch_index in range(batch):
        batch_name = (
            f"{project_name or 'Short Drama'}#{batch_index + 1}"
            if batch > 1
            else (project_name or "Short Drama")
        )
        print(f"\n[3/6] Creating project: {batch_name}")
        project = _unwrap_payload_data(_common.create_project(batch_name, script_text))
        project_id = project.get("id")
        if not project_id:
            raise RuntimeError("project id missing from create_project response")
        all_projects.append(project_id)
        print(f"  [OK] Project created: {project_id}")

        print("\n[4/6] Queueing image sessions...")
        image_jobs = _queue_media_sessions(
            project_id=project_id,
            scenes=scenes,
            media_type="image",
            aspect=aspect,
            style=style,
        )
        for job in image_jobs:
            print(
                f"  [QUEUED] image scene {job['scene_index']} -> "
                f"node={job['node_id']} session={job['session_id']}"
            )

        print("\n[5/6] Waiting for image sessions...")
        image_completed, image_failed = _wait_jobs(image_jobs, concurrent)
        image_node_lookup = {
            job["scene_index"]: job["node_id"] for job in image_completed if job.get("node_id")
        }

        video_completed = []
        video_failed = []
        if not skip_video:
            print("\n[5.5/6] Queueing video sessions...")
            video_jobs = _queue_media_sessions(
                project_id=project_id,
                scenes=scenes,
                media_type="video",
                aspect=aspect,
                style=style,
                parent_lookup=image_node_lookup,
            )
            for job in video_jobs:
                print(
                    f"  [QUEUED] video scene {job['scene_index']} -> "
                    f"node={job['node_id']} session={job['session_id']}"
                )
            print("\n[5.6/6] Waiting for video sessions...")
            video_completed, video_failed = _wait_jobs(video_jobs, concurrent)
        else:
            print("\n[5.5/6] Skipping video generation")

        subtitle_result = None
        subtitle_failed = False
        if not skip_subtitle:
            print("\n[6/6] Exporting subtitles...")
            from export_subtitle import export

            subtitle_result = export(project_id)
            if subtitle_result["ok"]:
                print(f"  [OK] SRT: {subtitle_result['srt']}")
                print(f"  [OK] Script: {subtitle_result['script']}")
            else:
                subtitle_failed = True
                print(f"  [FAIL] Subtitle export: {subtitle_result.get('error', 'unknown error')}")
        else:
            print("\n[6/6] Skipping subtitle export")

        canvas_url = f"{os.environ.get('CANVAS_BASE_URL', 'http://localhost:8789')}/canvas?projectId={project_id}"
        print("\nProject summary")
        print(f"  Images: {len(image_completed)} completed / {len(image_failed)} failed")
        print(f"  Videos: {len(video_completed)} completed / {len(video_failed)} failed")
        print(f"  Canvas: {canvas_url}")
        total_image_failures += len(image_failed)
        total_video_failures += len(video_failed)
        total_subtitle_failures += 1 if subtitle_failed else 0
        project_summaries.append(
            {
                "project_id": project_id,
                "canvas_url": canvas_url,
                "images": {
                    "queued": len(image_jobs),
                    "completed": len(image_completed),
                    "failed": len(image_failed),
                },
                "videos": {
                    "queued": 0 if skip_video else len(video_completed) + len(video_failed),
                    "completed": len(video_completed),
                    "failed": len(video_failed),
                },
                "subtitle": {
                    "ok": False if subtitle_failed else True,
                    "error": subtitle_result.get("error", "") if isinstance(subtitle_result, dict) else "",
                },
            }
        )

    total_failures = total_image_failures + total_video_failures + total_subtitle_failures
    return {
        "ok": total_failures == 0,
        "projects": all_projects,
        "project_summaries": project_summaries,
        "scenes_per_project": len(scenes),
        "batch": batch,
        "image_failures": total_image_failures,
        "video_failures": total_video_failures,
        "subtitle_failures": total_subtitle_failures,
        "failed_jobs": total_failures,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TRIX Canvas Workflow")
    parser.add_argument("script", help="Script text or .txt file path")
    parser.add_argument("--project-name", default="", help="Project name")
    parser.add_argument("--concurrent", type=int, default=3, help="Session polling concurrency")
    parser.add_argument("--skip-video", action="store_true", help="Skip video generation")
    parser.add_argument("--skip-subtitle", action="store_true", help="Skip subtitle export")
    parser.add_argument(
        "--batch",
        type=int,
        default=1,
        help="Number of batches to generate",
    )
    parser.add_argument(
        "--aspect",
        default="origin",
        choices=["9:16", "16:9", "1:1", "4:3", "origin"],
        help="Video aspect ratio for generation/export",
    )
    parser.add_argument("--style", default="", help="Style preset passed to Canvas session")
    args = parser.parse_args()

    if os.path.isfile(args.script):
        with open(args.script, "r", encoding="utf-8") as fh:
            script_text = fh.read()
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
        style=args.style,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result.get("ok", False):
        sys.exit(1)
