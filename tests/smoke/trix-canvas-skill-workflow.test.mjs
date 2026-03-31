import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SCRIPT_DIR = resolve(REPO_ROOT, 'skills/trix-canvas-skill/scripts');

test('workflow reports queued image failures and blocks dependent video jobs', () => {
  const code = `
import json
import sys
import types

sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *args, **kwargs: []
workflow.parse_script = lambda text: [
    {"index": 1, "text": "scene 1", "media_type": "image"},
    {"index": 2, "text": "scene 2", "media_type": "image"},
]

create_calls = []

def create_project(name, script_text):
    return {"data": {"id": "proj_1"}}

def create_session(message, project_id=None, media_type="image", aspect="origin", style="", parent_node_id=None, **kwargs):
    create_calls.append({
        "message": message,
        "project_id": project_id,
        "media_type": media_type,
        "parent_node_id": parent_node_id,
    })
    if media_type == "image" and message == "scene 1":
        return {"data": {"sessionId": "img_1", "nodeId": "img_node_1", "status": "generating"}}
    if media_type == "image" and message == "scene 2":
        return {"data": {"nodeId": "img_node_2", "status": "generating"}}
    if media_type == "video" and message == "scene 1":
        return {"data": {"sessionId": "vid_1", "nodeId": "vid_node_1", "status": "generating"}}
    raise AssertionError(f"unexpected create_session call: {media_type} {message}")

def wait_for_session(session_id, timeout=300, poll_interval=2):
    return {"status": "completed", "sessionId": session_id, "resultUrls": ["/media/files/mock.png"]}

workflow._common.create_project = create_project
workflow._common.create_session = create_session
workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(
    export=lambda project_id: {"ok": True, "srt": "demo.srt", "script": "demo.md"}
)

result = workflow.run_workflow(
    "ignored",
    project_name="Workflow Demo",
    concurrent=2,
    skip_video=False,
    skip_subtitle=False,
)
print(json.dumps({"result": result, "create_calls": create_calls}, ensure_ascii=False))
`;

  const result = spawnSync('python3', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = result.stdout.trim().split('\n').filter(Boolean);
  const payload = JSON.parse(output.at(-1));

  assert.equal(payload.result.ok, false, result.stdout);
  assert.equal(payload.result.image_failures, 1, result.stdout);
  assert.equal(payload.result.video_failures, 1, result.stdout);
  assert.equal(payload.result.subtitle_failures, 0, result.stdout);
  assert.equal(payload.result.failed_jobs, 2, result.stdout);
  assert.equal(payload.result.project_summaries[0].images.failed, 1, result.stdout);
  assert.equal(payload.result.project_summaries[0].videos.failed, 1, result.stdout);
  assert.equal(payload.create_calls.length, 3, result.stdout);
  assert.deepEqual(payload.create_calls[2], {
    message: 'scene 1',
    project_id: 'proj_1',
    media_type: 'video',
    parent_node_id: 'img_node_1',
  });
});
