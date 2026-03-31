"""Sync or verify the packaged Canvas runtime embedded in the skill."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from _paths import PACKAGED_SERVICE_DIR, resolve_canvas_service_dir, sync_packaged_canvas_service

SYNC_FILES = (
    "README.md",
    "canvasSecurity.js",
    "package.json",
    "proxy.js",
    "relay.js",
    "server.js",
    "start-all.js",
    "public/canvas.html",
)


def file_sha1(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()


def compare_runtime(source_dir: Path, target_dir: Path) -> dict[str, dict[str, bool]]:
    report: dict[str, dict[str, bool]] = {}
    for relative in SYNC_FILES:
        src = source_dir / relative
        dst = target_dir / relative
        report[relative] = {
            "source_exists": src.exists(),
            "target_exists": dst.exists(),
            "matches": src.exists() and dst.exists() and file_sha1(src) == file_sha1(dst),
        }
    return report


def all_files_match(report: dict[str, dict[str, bool]]) -> bool:
    return all(bool(item["matches"]) for item in report.values())


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync or verify the packaged Canvas runtime")
    parser.add_argument(
        "--source",
        default="",
        help="Override the source canvas-service directory",
    )
    parser.add_argument(
        "--target",
        default="",
        help="Override the packaged target directory",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Only verify that packaged runtime matches the source without copying",
    )
    args = parser.parse_args()

    source_dir = Path(args.source).expanduser().resolve() if args.source else resolve_canvas_service_dir()
    target_dir = Path(args.target).expanduser().resolve() if args.target else PACKAGED_SERVICE_DIR

    if not args.check:
        sync_packaged_canvas_service(source_dir, target_dir)

    report = compare_runtime(source_dir, target_dir)
    payload = {
        "ok": all_files_match(report),
        "source": str(source_dir),
        "target": str(target_dir),
        "check_only": args.check,
        "files": report,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
