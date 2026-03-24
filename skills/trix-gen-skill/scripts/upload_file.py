#!/usr/bin/env python3
"""上传参考图/视频到 OSS：POST /api/file/upload"""

import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(__file__))
from _common import UPLOAD_API_URL, AI_API_KEY


def upload_file(file_path: str) -> dict:
    """
    将本地文件上传到 OSS，返回可访问的 URL。
    支持通过 Canvas 服务代理，或直传 OSS。
    """
    if not os.path.isfile(file_path):
        print(f"错误：文件不存在: {file_path}", file=sys.stderr)
        sys.exit(1)

    mime_type, _ = mimetypes.guess_type(file_path)
    filename = os.path.basename(file_path)

    with open(file_path, "rb") as f:
        file_data = base64.b64encode(f.read()).decode("utf-8")

    body = json.dumps({
        "fileData": file_data,
        "filename": filename,
        "mimeType": mime_type or "application/octet-stream",
    }, ensure_ascii=False).encode("utf-8")

    if UPLOAD_API_URL:
        # 直传 OSS
        headers = {"Content-Type": "application/json"}
        if AI_API_KEY:
            headers["Authorization"] = f"Bearer {AI_API_KEY}"
        req = urllib.request.Request(
            UPLOAD_API_URL,
            data=body,
            method="POST",
            headers=headers,
        )
    else:
        # 回退到 Canvas 服务上传接口
        from _common import CANVAS_BASE
        url = f"{CANVAS_BASE.rstrip('/')}/api/file/upload"
        req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result.get("data", {})
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8") if e.fp else ""
        print(f"上传错误 {e.code}: {err_body}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"网络错误: {e.reason}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="上传图片或视频文件到 OSS，返回可访问的 URL",
        epilog="""
环境变量:
  UPLOAD_API_URL 可选，OSS 直传地址
  AI_API_KEY     可选，OSS 鉴权 Token
  CANVAS_BASE_URL 可选，Canvas 服务地址（无 UPLOAD_API_URL 时使用）

示例:
  python3 upload_file.py /path/to/reference.png
  python3 upload_file.py /path/to/video.mp4
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("file", help="要上传的文件路径（图片或视频）")
    args = parser.parse_args()

    data = upload_file(args.file)
    oss_url = data.get("url") or data.get("data", {}).get("url") or ""
    if not oss_url:
        print("错误：未返回 URL", file=sys.stderr)
        sys.exit(1)

    print(json.dumps({"url": oss_url}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
