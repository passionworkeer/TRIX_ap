"""Install the packaged TRIX Canvas skill into an OpenClaw workspace."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from _paths import (
    SKILL_ROOT,
    ensure_canvas_node_runtime,
    resolve_canvas_service_dir,
    sync_packaged_canvas_service,
)

AGENTS_HINT_START = "<!-- TRIX_CANVAS_SKILL_HINT_START -->"
AGENTS_HINT_END = "<!-- TRIX_CANVAS_SKILL_HINT_END -->"


def resolve_workspace(agent_id: str, explicit_workspace: str | None) -> Path:
    if explicit_workspace:
        return Path(explicit_workspace).expanduser().resolve()

    openclaw_home = Path.home() / ".openclaw"
    config_path = openclaw_home / "openclaw.json"
    if config_path.exists():
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
            agents = config.get("agents", {}).get("list", [])
            for agent in agents:
                if agent.get("id") == agent_id and agent.get("workspace"):
                    return Path(agent["workspace"]).expanduser().resolve()
            if agent_id and agents:
                available = ", ".join(
                    sorted(str(agent.get("id")) for agent in agents if agent.get("id"))
                ) or "<none>"
                raise FileNotFoundError(
                    f"OpenClaw agent '{agent_id}' not found in {config_path}. "
                    f"Available agents: {available}. Use --workspace to override."
                )
            default_workspace = config.get("agents", {}).get("defaults", {}).get("workspace")
            if default_workspace:
                return Path(default_workspace).expanduser().resolve()
        except json.JSONDecodeError:
            pass
    return (openclaw_home / "workspace").resolve()


def update_agents_md(workspace_dir: Path) -> None:
    agents_path = workspace_dir / "AGENTS.md"
    hint = (
        f"{AGENTS_HINT_START}\n"
        "## Workspace Skill Hints\n\n"
        "- 当用户提到 Canvas、短剧、分镜、storyboard、镜头排队时，优先读取 "
        "`skills/trix-canvas-skill/SKILL.md` 并按其中脚本工作流执行。\n"
        f"{AGENTS_HINT_END}\n"
    )
    if agents_path.exists():
        content = agents_path.read_text(encoding="utf-8")
        if AGENTS_HINT_START in content and AGENTS_HINT_END in content:
            start = content.index(AGENTS_HINT_START)
            end = content.index(AGENTS_HINT_END) + len(AGENTS_HINT_END)
            prefix = content[:start].rstrip()
            suffix = content[end:].lstrip()
            parts = [part for part in (prefix, hint.rstrip(), suffix) if part]
            updated = "\n\n".join(parts)
        else:
            updated = content.rstrip() + "\n\n" + hint
    else:
        updated = hint
    agents_path.write_text(updated.rstrip() + "\n", encoding="utf-8")


def install(
    agent_id: str,
    workspace: str | None,
    install_deps: bool,
    update_agents_hint: bool,
    sync_runtime: bool,
) -> Path:
    workspace_dir = resolve_workspace(agent_id, workspace)
    target_dir = workspace_dir / "skills" / SKILL_ROOT.name
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    if target_dir.exists():
        shutil.rmtree(target_dir)
    shutil.copytree(
        SKILL_ROOT,
        target_dir,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store", "runtime"),
    )
    if sync_runtime:
        sync_packaged_canvas_service(
            resolve_canvas_service_dir(),
            target_dir / "assets" / "canvas-service",
        )
    if install_deps:
        ensure_canvas_node_runtime(target_dir / "assets" / "canvas-service")
    if update_agents_hint:
        update_agents_md(workspace_dir)
    return target_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Install TRIX Canvas skill into OpenClaw")
    parser.add_argument("--agent-id", default="main", help="OpenClaw agent id")
    parser.add_argument("--workspace", default="", help="Override target workspace path")
    parser.add_argument(
        "--install-deps",
        action="store_true",
        help="Run npm install inside the packaged canvas-service after copying",
    )
    parser.add_argument(
        "--update-agents-md",
        action="store_true",
        help="Append a short hint to the target workspace AGENTS.md so OpenClaw knows when to load this skill",
    )
    parser.add_argument(
        "--no-sync-runtime",
        action="store_true",
        help="Skip syncing assets/canvas-service from local packages runtime before install",
    )
    args = parser.parse_args()

    try:
        installed = install(
            agent_id=args.agent_id,
            workspace=args.workspace or None,
            install_deps=args.install_deps,
            update_agents_hint=args.update_agents_md,
            sync_runtime=not args.no_sync_runtime,
        )
        print(
            json.dumps(
                {
                    "ok": True,
                    "installed_to": str(installed),
                    "start_command": (
                        f"python3 {installed / 'scripts' / 'start_canvas.py'} --with-proxy --open"
                    ),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        sys.exit(1)
