"""TRIX Canvas skill runtime path helpers."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
RUNTIME_ROOT = Path(
    os.environ.get("TRIX_CANVAS_RUNTIME_DIR", str(SKILL_ROOT / "runtime"))
).expanduser().resolve()


def canvas_service_candidates() -> list[Path]:
    raw_candidates = [
        os.environ.get("TRIX_CANVAS_SERVICE_DIR", "").strip(),
        str(SKILL_ROOT / "assets" / "canvas-service"),
        str(SKILL_ROOT.parents[1] / "packages" / "trix-canvas-service")
        if len(SKILL_ROOT.parents) > 1
        else "",
        str(Path.cwd() / "packages" / "trix-canvas-service"),
    ]
    seen: set[str] = set()
    candidates: list[Path] = []
    for raw in raw_candidates:
        if not raw:
            continue
        resolved = Path(raw).expanduser().resolve()
        key = str(resolved)
        if key in seen:
            continue
        seen.add(key)
        candidates.append(resolved)
    return candidates


def resolve_canvas_service_dir() -> Path:
    for candidate in canvas_service_candidates():
        if (candidate / "server.js").exists() and (candidate / "package.json").exists():
            return candidate
    joined = "\n".join(f"- {path}" for path in canvas_service_candidates())
    raise FileNotFoundError(
        "TRIX Canvas service runtime not found. Checked:\n"
        f"{joined or '- <none>'}"
    )


def default_canvas_data_dir() -> Path:
    return Path(
        os.environ.get("CANVAS_DATA_DIR", str(RUNTIME_ROOT / "data"))
    ).expanduser().resolve()


def default_canvas_export_dir() -> Path:
    return Path(
        os.environ.get("CANVAS_EXPORT_DIR", str(RUNTIME_ROOT / "exports"))
    ).expanduser().resolve()


def ensure_canvas_runtime_dirs() -> tuple[Path, Path]:
    data_dir = default_canvas_data_dir()
    export_dir = default_canvas_export_dir()
    for child in ("projects", "nodes", "edges", "files", "sessions", "blobs"):
        (data_dir / child).mkdir(parents=True, exist_ok=True)
    export_dir.mkdir(parents=True, exist_ok=True)
    return data_dir, export_dir


def ensure_canvas_node_runtime(service_dir: Path) -> None:
    if (service_dir / "node_modules" / "express").exists():
        return
    npm_bin = shutil.which("npm")
    if not npm_bin:
        raise RuntimeError("npm not found in PATH")
    print(
        f"[INFO] Installing Canvas service dependencies in {service_dir}",
        file=sys.stderr,
    )
    subprocess.run(
        [npm_bin, "install", "--no-fund", "--no-audit"],
        cwd=str(service_dir),
        check=True,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
