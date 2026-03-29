"""导出 .srt 字幕 + 台词文档（真实视频时长）"""

import argparse
import json
import os
import subprocess
import sys

import _common


def get_video_duration(filepath: str) -> float:
    """用 ffprobe 读取视频实际时长（秒）"""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_format", filepath,
            ],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return float(data.get("format", {}).get("duration", 0)) or 3.0
    except Exception:
        pass
    return 3.0  # fallback 默认 3 秒


def format_srt_time(seconds: float) -> str:
    """秒数 -> SRT 时间格式 HH:MM:SS,mmm。使用 Decimal 避免浮点陷阱"""
    from decimal import Decimal, ROUND_HALF_UP
    secs = Decimal(str(seconds))
    h = int(secs // 3600)
    m = int((secs % 3600) // 60)
    s = int(secs % 60)
    ms = int((secs % 1).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP) * 1000)
    # 进位：如果 ms == 1000，推进时间
    if ms >= 1000:
        ms -= 1000
        s += 1
        if s >= 60:
            s -= 60
            m += 1
            if m >= 60:
                m -= 60
                h += 1
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def export(project_id: int, output_dir: str = "") -> dict:
    """
    导出字幕和台词文档。

    使用 ffprobe 读取每个视频节点的真实时长，
    生成精确的 SRT 时间戳。
    """
    project = _common.get_project(project_id)
    nodes = project.get("nodes", [])
    nodes.sort(key=lambda x: (x.get("scene_id") or 0, x.get("id", 0)))

    if not nodes:
        return {"ok": False, "error": "项目没有节点"}

    files = project.get("files", [])
    file_map = {f["id"]: f for f in files}

    name = project.get("name", "project")
    out_dir = output_dir or "."
    os.makedirs(out_dir, exist_ok=True)

    # ---------- 收集每个镜头的实际时长 ----------
    current_time = 0.0
    scene_durations = []  # [(start_time, duration, node), ...]

    for n in nodes:
        fid = n.get("file_id")
        duration = 3.0  # 默认 3 秒

        if fid and fid in file_map:
            f = file_map[fid]
            abs_path = _common.get_file_path(f["filepath"])
            if os.path.exists(abs_path) and n.get("media_type") == "video":
                duration = get_video_duration(abs_path)
            elif n.get("media_type") == "video":
                # 下载后写入临时文件再读取时长
                try:
                    data = _common.download_media(f["filepath"])
                    import tempfile as _tf
                    ext = os.path.splitext(f["filepath"])[-1] or ".mp4"
                    with _tf.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                        tmp.write(data)
                        downloaded = tmp.name
                    duration = get_video_duration(downloaded)
                    try:
                        os.unlink(downloaded)
                    except Exception:
                        pass
                except Exception:
                    pass  # 保持 duration=3.0

        scene_durations.append((current_time, duration, n))
        current_time += duration

    # ---------- 生成 .srt ----------
    srt_path = os.path.join(out_dir, f"{name}.srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        for i, (start, dur, n) in enumerate(scene_durations, 1):
            end = start + dur
            start_str = format_srt_time(start)
            end_str = format_srt_time(end)
            text = n.get("prompt") or f"镜头 {n.get('scene_id', i)}"
            # 限制每条字幕不超过 100 字符
            if len(text) > 100:
                text = text[:97] + "..."
            f.write(f"{i}\n{start_str} --> {end_str}\n{text}\n\n")

    # ---------- 生成台词文档 ----------
    script_path = os.path.join(out_dir, f"{name}_script.md")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(f"# {name}\n\n")
        f.write(f"## 总时长: {format_srt_time(current_time)}\n\n")
        for i, (start, dur, n) in enumerate(scene_durations, 1):
            scene = n.get("scene_id", i)
            media = "🎬 视频" if n.get("media_type") == "video" else "🖼️ 图片"
            prompt = n.get("prompt") or "(无描述)"
            f.write(f"## {media} 镜头 {scene} [{format_srt_time(dur)}]\n")
            f.write(f"{prompt}\n\n")

    return {
        "ok": True,
        "srt": srt_path,
        "script": script_path,
        "total_duration": round(current_time, 2),
        "scenes": len(scene_durations),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="导出字幕和台词（真实时长）")
    parser.add_argument("project_id", type=int)
    parser.add_argument("--output-dir", "-d", default="")
    args = parser.parse_args()

    result = export(args.project_id, args.output_dir)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        sys.exit(1)
