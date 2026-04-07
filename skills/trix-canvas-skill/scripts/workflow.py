"""TRIX Canvas 完整工作流 — Agent 调用一个脚本即完成全部工作

支持两种模式：
  1. 普通模式（默认）：解析脚本 → 生成图片/视频镜头 → 导出
  2. 短剧模式（--drama-mode）：收集需求 → 角色图 → 首尾帧 → VEO 视频 → 拼接
"""

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


def _normalize_scene_media_type(scene: dict) -> str:
    media_type = str(scene.get("media_type") or scene.get("mediaType") or "image").strip().lower()
    return media_type if media_type in {"image", "video"} else "image"


def _should_retry_failure(failure: dict) -> bool:
    payload = failure.get("result") if isinstance(failure, dict) else None
    error = str(
        (payload or {}).get("error")
        or (failure or {}).get("error")
        or ""
    ).lower()
    non_retryable_markers = (
        "plan not support",
        "does not support",
        "invalid params",
        "missing parent image node",
        # 鉴权/权限/资源类错误
        "unauthorized",
        "authentication",
        "credential",
        "quota",
        "rate limit",
        "rate_limit",
        "429",
        "403",
        "billing",
        "insufficient",
    )
    return not any(marker in error for marker in non_retryable_markers)


def _count_video_scenes(scenes: list[dict]) -> int:
    return sum(1 for scene in scenes if _normalize_scene_media_type(scene) == "video")


def _normalize_capability_status(raw_status: object) -> str:
    status = str(raw_status or "").strip().lower()
    return status if status in {"ready", "unavailable", "unknown"} else ""


def _get_capability_status(capabilities: dict | None, key: str) -> str:
    if not isinstance(capabilities, dict):
        return ""
    explicit = _normalize_capability_status(capabilities.get(f"{key}Status"))
    if explicit:
        return explicit
    ready_flag = capabilities.get(f"{key}Ready")
    if ready_flag is True:
        return "ready"
    return ""


def _get_capability_reason(capabilities: dict | None, key: str) -> str:
    if not isinstance(capabilities, dict):
        return ""
    reasons = capabilities.get("reasons")
    if isinstance(reasons, dict):
        reason = str(reasons.get(key) or "").strip()
        if reason:
            return reason
    return str(capabilities.get(f"{key}Reason") or "").strip()


def _build_preflight_failure(
    *,
    script_scene_count: int,
    batch: int,
    capabilities: dict | None,
    error: str,
) -> dict:
    return {
        "ok": False,
        "error": error,
        "preflight_failed": True,
        "preflight_failures": batch,
        "capabilities": capabilities or {},
        "projects": [],
        "project_summaries": [],
        "scenes_per_project": script_scene_count,
        "batch": batch,
        "image_failures": 0,
        "video_failures": 0,
        "subtitle_failures": 0,
        "final_video_failures": 0,
        "failed_jobs": batch,
    }


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


def _create_scene_job(
    project_id: str,
    scene: dict,
    aspect: str,
    style: str,
    last_image_node_id: str | None,
    image_size: str | None = None,
    thinking_mode: str | None = None,
) -> dict:
    media_type = _normalize_scene_media_type(scene)
    parent_node_id = last_image_node_id if media_type == "video" else None
    if media_type == "video" and not parent_node_id:
        return {
            "scene_index": scene["index"],
            "scene_text": scene["text"],
            "media_type": media_type,
            "session_id": "",
            "node_id": "",
            "status": "error",
            "error": "missing parent image node",
        }

    try:
        payload = _common.create_session(
            message=scene["text"],
            project_id=project_id,
            media_type=media_type,
            aspect=aspect,
            style=style,
            parent_node_id=parent_node_id,
            image_size=image_size,
            thinking_mode=thinking_mode,
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
        return job
    except Exception as exc:  # noqa: BLE001
        return {
            "scene_index": scene["index"],
            "scene_text": scene["text"],
            "media_type": media_type,
            "session_id": "",
            "node_id": "",
            "status": "error",
            "error": str(exc),
        }


def _run_scene_jobs(
    project_id: str,
    scenes: list[dict],
    aspect: str,
    style: str,
    skip_video: bool,
    retries: int,
    image_size: str | None = None,
    thinking_mode: str | None = None,
) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    image_completed = []
    image_failed = []
    video_completed = []
    video_failed = []
    last_image_node_id = None

    for scene in scenes:
        media_type = _normalize_scene_media_type(scene)
        if media_type == "video" and skip_video:
            print(f"  [SKIP] video scene {scene['index']}: video generation skipped")
            continue

        final_failure = None
        for attempt in range(retries + 1):
            job = _create_scene_job(
                project_id=project_id,
                scene=scene,
                aspect=aspect,
                style=style,
                last_image_node_id=last_image_node_id,
                image_size=image_size,
                thinking_mode=thinking_mode,
            )
            print(
                f"  [QUEUED] {job['media_type']} scene {job['scene_index']} -> "
                f"node={job.get('node_id', '')} session={job.get('session_id', '')}"
            )

            if not job.get("session_id"):
                error = job.get("error") or "sessionId missing from response"
                final_failure = {**job, "result": {"status": "error", "error": error}}
                print(f"  [FAIL] [queue] {job['media_type']} scene {job['scene_index']}: {error}")
            else:
                try:
                    result = _poll_job(job)
                except Exception as exc:  # noqa: BLE001
                    result = {
                        **job,
                        "result": {"status": "error", "error": str(exc)},
                    }

                payload = result["result"]
                status = str(payload.get("status", "")).lower()
                if status == "completed":
                    if job["media_type"] == "image":
                        image_completed.append(result)
                        last_image_node_id = job.get("node_id") or None
                    else:
                        video_completed.append(result)
                    print(f"  [OK] {job['media_type']} scene {job['scene_index']} completed")
                    final_failure = None
                    break

                final_failure = result
                print(
                    f"  [FAIL] {job['media_type']} scene {job['scene_index']}: "
                    f"{payload.get('error', 'unknown error')}"
                )

            if attempt < retries and final_failure and _should_retry_failure(final_failure):
                print(
                    f"  [RETRY] {media_type} scene {scene['index']} "
                    f"({attempt + 1}/{retries})"
                )
                continue
            if final_failure:
                break

        if final_failure is None:
            continue

        if media_type == "image":
            image_failed.append(final_failure)
            last_image_node_id = None
        else:
            video_failed.append(final_failure)

    return image_completed, image_failed, video_completed, video_failed


def run_workflow(
    script_text: str,
    project_name: str = "",
    concurrent: int = 3,
    skip_video: bool = False,
    skip_subtitle: bool = False,
    skip_final_video: bool = False,
    retries: int = 1,
    batch: int = 1,
    aspect: str = "origin",
    style: str = "",
    image_size: str | None = None,
    thinking_mode: str | None = None,
):
    """
    执行完整工作流。
    """
    print("[1/6] Checking environment...")
    errors = check_all()
    if errors:
        raise RuntimeError("\n".join(errors))
    print("  [OK] Environment ready")

    print("\n[2/6] Parsing script...")
    scenes = parse_script(script_text)
    if not scenes:
        raise RuntimeError("没有解析出任何镜头")
    print(f"  [OK] Parsed {len(scenes)} scenes")

    capabilities = {}
    video_scene_count = _count_video_scenes(scenes)
    if video_scene_count > 0 and not skip_video:
        capabilities = _common.get_canvas_capabilities()
        image_to_video_status = _get_capability_status(capabilities, "imageToVideo")
        if image_to_video_status == "unavailable":
            reason = _get_capability_reason(capabilities, "imageToVideo") or "图生视频能力不可用"
            print("\n[3/6] Capability preflight failed")
            print(f"  [FAIL] {reason}")
            return _build_preflight_failure(
                script_scene_count=len(scenes),
                batch=batch,
                capabilities=capabilities,
                error=f"Video scenes require image-to-video support, but it is unavailable: {reason}",
            )

    all_projects = []
    project_summaries = []
    total_preflight_failures = 0
    total_image_failures = 0
    total_video_failures = 0
    total_subtitle_failures = 0
    total_final_video_failures = 0
    for batch_index in range(batch):
        batch_name = (
            f"{project_name or 'Short Drama'}-{batch_index + 1}"
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

        print("\n[4/6] Rendering scenes in script order...")
        image_completed, image_failed, video_completed, video_failed = _run_scene_jobs(
            project_id=project_id,
            scenes=scenes,
            aspect=aspect,
            style=style,
            skip_video=skip_video,
            retries=retries,
            image_size=image_size,
            thinking_mode=thinking_mode,
        )

        subtitle_result = None
        subtitle_failed = False
        if skip_subtitle:
            print("\n[5/6] Skipping subtitle export")
        else:
            print("\n[5/6] Exporting subtitles...")
            from export_subtitle import export

            subtitle_result = export(project_id)
            if subtitle_result["ok"]:
                print(f"  [OK] SRT: {subtitle_result['srt']}")
                print(f"  [OK] Script: {subtitle_result['script']}")
            else:
                subtitle_failed = True
                print(f"  [FAIL] Subtitle export: {subtitle_result.get('error', 'unknown error')}")

        final_video_result = None
        final_video_failed = False
        if skip_final_video:
            print("\n[6/6] Skipping final video export")
        elif skip_video:
            print("\n[6/6] Skipping final video export because video generation was skipped")
        elif video_scene_count == 0:
            print("\n[6/6] Skipping final video export because the script has no video scenes")
        elif video_failed:
            print("\n[6/6] Skipping final video export because one or more video scenes failed")
        elif not video_completed:
            print("\n[6/6] Skipping final video export because no video scenes completed")
        else:
            print("\n[6/6] Exporting final video...")
            from export_video import export as export_final_video

            final_video_result = export_final_video(project_id, aspect=aspect)
            if final_video_result["ok"]:
                print(f"  [OK] Final video: {final_video_result['path']}")
            else:
                final_video_failed = True
                print(
                    f"  [FAIL] Final video export: "
                    f"{final_video_result.get('error', 'unknown error')}"
                )

        canvas_url = f"{os.environ.get('CANVAS_BASE_URL', 'http://localhost:8789')}/canvas?projectId={project_id}"
        print("\nProject summary")
        print(f"  Images: {len(image_completed)} completed / {len(image_failed)} failed")
        print(f"  Videos: {len(video_completed)} completed / {len(video_failed)} failed")
        if isinstance(final_video_result, dict) and final_video_result.get("ok"):
            print(f"  Final video: {final_video_result['path']}")
        print(f"  Canvas: {canvas_url}")
        total_image_failures += len(image_failed)
        total_video_failures += len(video_failed)
        total_subtitle_failures += 1 if subtitle_failed else 0
        total_final_video_failures += 1 if final_video_failed else 0
        image_scene_count = sum(1 for scene in scenes if _normalize_scene_media_type(scene) == "image")
        project_summaries.append(
            {
                "project_id": project_id,
                "canvas_url": canvas_url,
                "images": {
                    "queued": image_scene_count,
                    "completed": len(image_completed),
                    "failed": len(image_failed),
                },
                "videos": {
                    "queued": 0 if skip_video else video_scene_count,
                    "completed": len(video_completed),
                    "failed": len(video_failed),
                },
                "subtitle": {
                    "ok": False if subtitle_failed else True,
                    "error": subtitle_result.get("error", "") if isinstance(subtitle_result, dict) else "",
                    "srt": subtitle_result.get("srt", "") if isinstance(subtitle_result, dict) else "",
                    "script": subtitle_result.get("script", "") if isinstance(subtitle_result, dict) else "",
                    "srt_url": subtitle_result.get("srt_url", "") if isinstance(subtitle_result, dict) else "",
                    "script_url": subtitle_result.get("script_url", "") if isinstance(subtitle_result, dict) else "",
                },
                "final_video": {
                    "ok": isinstance(final_video_result, dict) and bool(final_video_result.get("ok")),
                    "path": final_video_result.get("path", "") if isinstance(final_video_result, dict) else "",
                    "url": final_video_result.get("url", "") if isinstance(final_video_result, dict) else "",
                    "error": final_video_result.get("error", "") if isinstance(final_video_result, dict) else "",
                    "skipped": (
                        skip_final_video
                        or skip_video
                        or video_scene_count == 0
                        or bool(video_failed)
                        or not video_completed
                    ),
                },
            }
        )

    total_failures = (
        total_preflight_failures
        + total_image_failures
        + total_video_failures
        + total_subtitle_failures
        + total_final_video_failures
    )
    return {
        "ok": total_failures == 0,
        "capabilities": capabilities,
        "projects": all_projects,
        "project_summaries": project_summaries,
        "scenes_per_project": len(scenes),
        "batch": batch,
        "preflight_failures": total_preflight_failures,
        "image_failures": total_image_failures,
        "video_failures": total_video_failures,
        "subtitle_failures": total_subtitle_failures,
        "final_video_failures": total_final_video_failures,
        "failed_jobs": total_failures,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TRIX Canvas Workflow")
    parser.add_argument("script", help="Script text or .txt file path (普通模式)")
    parser.add_argument("--drama-mode", action="store_true",
                        help="启用短剧模式：角色→首尾帧→VEO 视频完整流程")
    parser.add_argument("--project-name", default="", help="Project name")
    parser.add_argument("--concurrent", type=int, default=3, help="Session polling concurrency")
    parser.add_argument("--skip-video", action="store_true", help="Skip video generation")
    parser.add_argument("--skip-subtitle", action="store_true", help="Skip subtitle export")
    parser.add_argument("--skip-final-video", action="store_true", help="Skip final video export")
    parser.add_argument("--retries", type=int, default=1, help="Retries per failed scene")
    parser.add_argument(
        "--batch",
        type=int,
        default=1,
        help="Number of batches to generate",
    )
    parser.add_argument(
        "--aspect",
        default="origin",
        choices=[
            "1:1", "16:9", "9:16", "4:3", "3:2", "2:3",
            "3:4", "4:5", "5:4", "21:9",
            "1:4", "4:1", "1:8", "8:1",
            "origin", "portrait", "landscape", "square",
        ],
        help="视频宽高比",
    )
    parser.add_argument("--style", default="", help="Style preset passed to Canvas session")
    parser.add_argument(
        "--image-size",
        choices=["512", "1K", "2K", "4K"],
        default=None,
        help="Nano Banana 2 输出分辨率：512=低分辨率预览，1K=默认，2K=高清，4K=超高清",
    )
    parser.add_argument(
        "--thinking-mode",
        choices=["minimal", "high"],
        default=None,
        help="Nano Banana 2 思维模式：minimal=快速，high=深度推理（复杂构图更准）",
    )
    args = parser.parse_args()

    if args.drama_mode:
        # 短剧模式：透传到 drama_workflow.py
        import drama_workflow
        req_source = args.script if not os.path.isfile(args.script) else None
        try:
            result = drama_workflow.run_drama_workflow(
                requirements_source=req_source,
                ask_interactive=False,
            )
            print(json.dumps(result, ensure_ascii=False, indent=2))
            if not result.get("ok", False):
                sys.exit(1)
        except Exception as exc:
            print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
            sys.exit(1)
        sys.exit(0)

    if os.path.isfile(args.script):
        with open(args.script, "r", encoding="utf-8") as fh:
            script_text = fh.read()
    else:
        script_text = args.script

    try:
        result = run_workflow(
            script_text,
            project_name=args.project_name,
            concurrent=args.concurrent,
            skip_video=args.skip_video,
            skip_subtitle=args.skip_subtitle,
            skip_final_video=args.skip_final_video,
            retries=args.retries,
            batch=args.batch,
            aspect=args.aspect,
            style=args.style,
            image_size=args.image_size,
            thinking_mode=args.thinking_mode,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if not result.get("ok", False):
            sys.exit(1)
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        sys.exit(1)
