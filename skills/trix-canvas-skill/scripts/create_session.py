"""创建 OpenClaw 会话 / 发送生成指令"""

from __future__ import annotations

import argparse
import json
import sys

import _common


def run(
    message: str,
    project_id: int | str | None = None,
    session_id: str | None = None,
    media_type: str = "image",
    aspect: str = "origin",
    style: str = "",
    parent_node_id: str | None = None,
    image_size: str | None = None,
    thinking_mode: str | int | None = None,
    input_image: str | None = None,
) -> dict:
    """创建新会话或者向已有会话发送指令"""
    resp = _common.create_session(
        message,
        project_id=project_id,
        session_id=session_id,
        media_type=media_type,
        aspect=aspect,
        style=style,
        parent_node_id=parent_node_id,
        image_size=image_size,
        thinking_mode=thinking_mode,
        input_image=input_image,
    )
    if not isinstance(resp, dict):
        raise RuntimeError("Unexpected session response")
    if resp.get("error"):
        raise RuntimeError(resp["error"])
    data = resp.get("data") or resp
    if not data.get("sessionId"):
        raise RuntimeError("sessionId missing from response")
    return data


def _main():
    parser = argparse.ArgumentParser(description="向 Canvas session 提交生成指令")
    parser.add_argument("message", help="用户提示词或生成指令")
    parser.add_argument("--project-id", type=str, help="绑定的项目 ID（可选）")
    parser.add_argument("--session-id", help="复用已有 session（可选）")
    parser.add_argument("--type", choices=["image", "video"], default="image")
    parser.add_argument(
        "--aspect",
        # Nano Banana 2 支持全部 14 种宽高比
        choices=[
            "1:1", "16:9", "9:16", "4:3", "3:2", "2:3",
            "3:4", "4:5", "5:4", "21:9",
            "1:4", "4:1", "1:8", "8:1",
            "origin", "portrait", "landscape", "square",
        ],
        default="origin",
        help="宽高比（默认 origin=1:1）。portrait=9:16，landscape=16:9，square=1:1",
    )
    parser.add_argument(
        "--image-size",
        choices=["512", "1K", "2K", "4K"],
        default=None,
        help="Nano Banana 2 输出分辨率（默认 1K）：512=低分辨率预览，1K=默认，2K=高清，4K=超高清",
    )
    parser.add_argument(
        "--thinking-mode",
        choices=["minimal", "high"],
        default=None,
        help="Nano Banana 2 思维模式：minimal=快速生成，high=深度推理（复杂构图更准）",
    )
    parser.add_argument(
        "--input-image",
        default=None,
        help="图片编辑：传入 base64 data URL 或本地图片路径（会 base64 编码后发送）",
    )
    parser.add_argument("--style", default="")
    parser.add_argument(
        "--parent-node-id",
        help="可选：引用已有图片节点作为视频/变体生成的父节点",
    )
    args = parser.parse_args()

    input_image = args.input_image
    if input_image and not input_image.startswith("data:"):
        # 尝试读取本地文件
        import base64 as _b64
        from pathlib import Path
        path = Path(input_image)
        if path.exists():
            mime = "image/png" if path.suffix.lower() in {".png", ""} else "image/jpeg"
            input_image = f"data:{mime};base64,{_b64.b64encode(path.read_bytes()).decode()}"
        # 如果不是本地文件，当作 raw base64 字符串处理

    try:
        data = run(
            args.message,
            args.project_id,
            args.session_id,
            args.type,
            args.aspect,
            args.style,
            args.parent_node_id,
            args.image_size,
            args.thinking_mode,
            input_image,
        )
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    _main()
