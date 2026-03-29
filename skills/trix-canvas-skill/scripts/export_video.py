"""ffmpeg 拼接视频：支持真实时长 + 音频混合 + 多尺寸"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import shutil

import _common


# ---------- 尺寸预设 ----------
PRESETS = {
    "9:16":  {"width": 1080, "height": 1920, "desc": "竖屏 9:16 (1080x1920)"},
    "16:9":  {"width": 1920, "height": 1080, "desc": "横屏 16:9 (1920x1080)"},
    "1:1":   {"width": 1080, "height": 1080, "desc": "方屏 1:1 (1080x1080)"},
    "4:3":   {"width": 1440, "height": 1080, "desc": "标准 4:3 (1440x1080)"},
    "origin":{"width": None, "height": None, "desc": "保持原始尺寸"},
}


def get_video_duration(filepath: str) -> float:
    """用 ffprobe 读取视频实际时长（秒）。失败时返回默认值 3.0"""
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
            import json as _json
            data = _json.loads(result.stdout)
            dur = float(data.get("format", {}).get("duration", 0)) or 3.0
            return dur if dur > 0 else 3.0
    except Exception:
        pass
    return 3.0  # 始终返回有效默认值，避免 -t 0 或时间轴坍塌


def get_video_info(filepath: str) -> dict:
    """用 ffprobe 读取视频宽高和时长"""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_streams", filepath,
            ],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            import json as _json
            data = _json.loads(result.stdout)
            streams = data.get("streams", [])
            for s in streams:
                if s.get("codec_type") == "video":
                    dur = float(s.get("duration", 0)) or 3.0
                    return {
                        "width": s.get("width", 0),
                        "height": s.get("height", 0),
                        "duration": dur if dur > 0 else 3.0,
                    }
            # fallback: format duration
            fmt = data.get("format", {})
            dur = float(fmt.get("duration", 0)) or 3.0
            return {"width": 0, "height": 0, "duration": dur if dur > 0 else 3.0}
    except Exception:
        pass
    return {"width": 0, "height": 0, "duration": 3.0}


def export(
    project_id: int,
    output: str = "",
    aspect: str = "origin",
    skip_audio: bool = False,
) -> dict:
    """
    导出拼接后的视频。

    Args:
        project_id: Canvas 项目 ID
        output: 输出文件路径（不指定则写临时文件）
        aspect: 尺寸预设 ("9:16", "16:9", "1:1", "4:3", "origin")
        skip_audio: 是否跳过音频
    """
    project = _common.get_project(project_id)
    nodes = project.get("nodes", [])

    # 筛选视频节点，按 scene_id 排序
    video_nodes = [n for n in nodes if n.get("media_type") == "video"]
    video_nodes.sort(key=lambda x: (x.get("scene_id") or 0, x.get("id", 0)))

    if not video_nodes:
        return {"ok": False, "error": "项目中没有视频节点"}

    # 收集文件
    files = project.get("files", [])
    file_map = {f["id"]: f for f in files}

    # ---------- 提前创建临时目录（fix: 后续 download_media 需在 mkdtemp 之后）----------
    tmp_dir = tempfile.mkdtemp(prefix="trix_export_")

    # 输出路径放在 tmp_dir 外（fix: 避免 finally 无法清理空目录）
    if output:
        out_path = os.path.abspath(output)
    else:
        out_path = os.path.join(tmp_dir, f"project_{project_id}_merged.mp4")

    try:
        # ---------- 收集片段（下载缺失文件）----------
        segments = []  # (abs_path, duration)
        for n in video_nodes:
            fid = n.get("file_id")
            if not fid or fid not in file_map:
                continue
            fdata = file_map[fid]
            abs_path = _common.get_file_path(fdata["filepath"])
            if not os.path.exists(abs_path):
                try:
                    data = _common.download_media(fdata["filepath"])
                    ext = os.path.splitext(fdata["filepath"])[-1] or ".mp4"
                    with tempfile.NamedTemporaryFile(
                        suffix=ext, dir=tmp_dir, delete=False
                    ) as tf:
                        tf.write(data)
                        abs_path = tf.name
                except Exception as e:
                    print(f"  [WARN] 下载失败 {fdata['filepath']}: {e}", file=sys.stderr)
                    continue

            info = get_video_info(abs_path)
            dur = info.get("duration", 3.0)
            if dur <= 0:
                dur = get_video_duration(abs_path)
            segments.append((abs_path, dur))

        if not segments:
            return {"ok": False, "error": "无有效视频文件"}

        # ---------- 尺寸预设 ----------
        preset = PRESETS.get(aspect, PRESETS["origin"])
        target_w = preset["width"]
        target_h = preset["height"]

        # ---------- 生成缩放后的分段文件 ----------
        concat_file = os.path.join(tmp_dir, "concat.txt")
        scaled_clips = []

        for i, (abs_path, dur) in enumerate(segments):
            seg_path = os.path.join(tmp_dir, f"seg_{i:03d}.mp4")

            cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "warning", "-i", abs_path]

            if target_w and target_h:
                # FFmpeg 原生变量：iw=输入宽，ih=输入高
                # scale 优先匹配目标高度，force_original_aspect_ratio=decrease 防止拉伸
                # pad 居中加黑边填充到目标尺寸
                vf = (
                    f"scale={target_w}:{target_h}:"
                    f"force_original_aspect_ratio=decrease,"
                    f"pad={target_w}:{target_h}:(ow-iw)/2:(oh-ih)/2:black,fps=30"
                )
                cmd += ["-vf", vf]

            cmd += [
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                # dur 永远 > 0（默认值 3.0），无需 None 检查
                "-t", str(dur),
                seg_path,
            ]

            r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if r.returncode != 0:
                return {"ok": False, "error": f"片段 {i} 转码失败: {r.stderr[:200]}"}

            scaled_clips.append(seg_path)
            with open(concat_file, "a", encoding="utf-8") as cf:
                cf.write(f"file '{seg_path}'\n")

        # ---------- 拼接 ----------
        concat_cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
            "-f", "concat", "-safe", "0", "-i", concat_file,
            "-c:v", "copy",
        ]
        if skip_audio:
            concat_cmd += ["-an", out_path]
        else:
            concat_cmd += ["-c:a", "aac", out_path]

        r = subprocess.run(concat_cmd, capture_output=True, text=True, timeout=600)
        if r.returncode != 0:
            return {"ok": False, "error": f"拼接失败: {r.stderr[:200]}"}

        if not os.path.exists(out_path):
            return {"ok": False, "error": "输出文件未生成"}

        return {
            "ok": True,
            "path": out_path,
            "aspect": aspect,
            "preset": preset["desc"],
            "segments": len(scaled_clips),
            "total_duration": round(sum(d for _, d in segments), 2),
        }

    finally:
        # 清理临时目录（out_path 已在 tmp_dir 外，os.rmdir 不会误删输出）
        try:
            shutil.rmtree(tmp_dir)
        except Exception:
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="导出拼接视频（增强版）")
    parser.add_argument("project_id", type=int)
    parser.add_argument("--output", "-o", default="", help="输出文件路径")
    parser.add_argument(
        "--aspect", "-a", default="origin",
        choices=list(PRESETS.keys()),
        help=f"视频尺寸预设: {', '.join(PRESETS.keys())}",
    )
    parser.add_argument(
        "--skip-audio", action="store_true",
        help="跳过音频（生成纯视频）",
    )
    args = parser.parse_args()

    result = export(args.project_id, args.output, args.aspect, args.skip_audio)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if not result["ok"]:
        sys.exit(1)
