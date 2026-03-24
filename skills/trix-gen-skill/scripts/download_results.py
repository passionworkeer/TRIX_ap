#!/usr/bin/env python3
"""下载生成结果：从会话中提取图片/视频 URL 并批量下载到本地"""

import argparse
import json
import os
import re
import sys
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(__file__))
from _common import query_session

# 支持的图片/视频后缀（按需增删）
MEDIA_PATTERN = re.compile(
    r'https?://[^\s"\'<>\[\]]+\.(?:png|jpg|jpeg|webp|gif|bmp|mp4|mov|webm|avi|mkv)(\?[^"\'<>\[\]]*)?',
    re.IGNORECASE
)


def extract_urls_from_messages(messages):
    """从会话消息中提取所有图片和视频 URL"""
    urls = []
    for msg in messages:
        content = msg.get("content", "")
        if not content or not isinstance(content, str):
            continue

        # 从 tool/assistant 消息的 JSON 中提取
        if msg.get("role") in ("tool", "assistant"):
            try:
                data = json.loads(content)
                # 通用字段兼容：images / videos / resultUrls / output.urls
                for key in ("images", "videos", "resultUrls", "urls", "output"):
                    val = data.get(key, [])
                    if isinstance(val, list):
                        for item in val:
                            url = item if isinstance(item, str) else item.get("url") or item.get("previewPath")
                            if url:
                                urls.append(url)
                    elif isinstance(val, dict):
                        url = val.get("url") or val.get("previewPath")
                        if url:
                            urls.append(url)
            except (json.JSONDecodeError, AttributeError):
                pass

        # 从纯文本消息中用正则提取
        found = MEDIA_PATTERN.findall(content)
        urls.extend(found)

    # 去重保序
    seen = set()
    unique = []
    for u in urls:
        clean = u.split("?")[0]  # 去 QueryString 避免重复
        if clean not in seen:
            seen.add(clean)
            unique.append(u)
    return unique


def download_file(url, filepath):
    """下载单个文件到本地"""
    req = urllib.request.Request(url, headers={"User-Agent": "TRIX-GEN-Skill/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            with open(filepath, "wb") as f:
                while True:
                    chunk = resp.read(8192)
                    if not chunk:
                        break
                    f.write(chunk)
        return filepath, None
    except Exception as e:
        return filepath, str(e)


def main():
    parser = argparse.ArgumentParser(
        description="下载会话中生成的图片/视频到本地",
        epilog="""
环境变量:
  CANVAS_BASE_URL 可选，Canvas 服务地址（默认 http://localhost:8789）

示例:
  python3 download_results.py SESSION_ID
  python3 download_results.py SESSION_ID --output-dir ~/Downloads/my_project
  python3 download_results.py SESSION_ID --prefix "cyberpunk" --workers 8
  python3 download_results.py --urls URL1 URL2 URL3
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("session_id", nargs="?", default="", help="会话 ID，从会话中提取生成结果 URL")
    parser.add_argument("--urls", nargs="+", default=[], help="直接指定要下载的 URL 列表（不需要 session_id）")
    parser.add_argument("--output-dir", default="", help="输出目录（默认 ~/Downloads/trix_gen/）")
    parser.add_argument("--prefix", default="", help="文件名前缀（如 'cyberpunk' → cyberpunk_01.png）")
    parser.add_argument("--workers", type=int, default=5, help="并行下载线程数（默认 5）")
    args = parser.parse_args()

    # 收集 URL
    urls = list(args.urls)
    if args.session_id:
        data = query_session(args.session_id)
        messages = data.get("messages", [])
        # 合并 resultUrls（已在 session 中解析好的）
        urls.extend(data.get("resultUrls", []))
        # 再从 messages 中提取
        urls.extend(extract_urls_from_messages(messages))

    if not urls:
        print(json.dumps({"error": "未找到可下载的图片/视频 URL", "downloaded": []}, ensure_ascii=False, indent=2))
        sys.exit(1)

    # 输出目录
    output_dir = args.output_dir or os.path.join(os.path.expanduser("~"), "Downloads", "trix_gen")
    os.makedirs(output_dir, exist_ok=True)

    # 分配下载任务
    tasks = []
    for i, url in enumerate(urls, 1):
        path_part = url.split("?")[0]
        ext = os.path.splitext(path_part)[-1] or ".png"
        if args.prefix:
            filename = f"{args.prefix}_{i:02d}{ext}"
        else:
            filename = f"{i:02d}{ext}"
        tasks.append((url, os.path.join(output_dir, filename)))

    # 并行下载
    results = []
    errors = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download_file, url, fp): (url, fp) for url, fp in tasks}
        for future in as_completed(futures):
            fp, err = future.result()
            if err:
                errors.append({"file": fp, "error": err})
            else:
                results.append(fp)

    results.sort()
    out = {"output_dir": output_dir, "downloaded": results, "total": len(results)}
    if errors:
        out["errors"] = errors
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
