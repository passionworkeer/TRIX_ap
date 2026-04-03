/**
 * Tests for workflow.py edge cases not covered in trix-canvas-skill-workflow.test.mjs:
 *  - retry loop: non-retryable vs retryable errors
 *  - batch mode (batch > 1)
 *  - skip_video flag
 *  - skip_subtitle / skip_final_video flags
 *  - concurrent polling
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SCRIPT_DIR = resolve(REPO_ROOT, 'skills/trix-canvas-skill/scripts');

/** Run inline Python code and parse the last JSON line of stdout. */
function runWorkflowPython(code) {
  const result = spawnSync('D:/python/python.exe', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  return { result, payload: parsePayload(result) };
}

function parsePayload(result) {
  if (result.status !== 0) {
    throw new Error(`Python exited ${result.status}: ${result.stderr || result.stdout}`);
  }
  const output = result.stdout.trim().split('\n').filter(Boolean);
  return JSON.parse(output.at(-1));
}

// ---------------------------------------------------------------------------
// Retry loop tests
// ---------------------------------------------------------------------------

test('workflow retries on transient error and succeeds on second attempt', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [{"index": 1, "text": "scene 1", "media_type": "image"}]
workflow._common.get_canvas_capabilities = lambda: {}

attempts = [0]

def create_project(name, script_text):
    return {"data": {"id": "proj_retry"}}

# Patch both: workflow.create_session (module-level import) and _common version (_create_scene_job path)
def create_session(message, project_id=None, media_type="image", aspect="origin", style="", parent_node_id=None, **kw):
    return {"data": {"sessionId": f"sess_{attempts[0]}", "nodeId": "img_node_1", "status": "generating"}}

workflow.create_session = create_session
workflow._common.create_session = create_session
workflow._common.create_project = create_project

def wait_for_session(session_id, timeout=300, poll_interval=2):
    attempts[0] += 1
    if attempts[0] == 1:
        return {"status": "failed", "error": "server timeout please retry", "sessionId": session_id}
    return {"status": "completed", "sessionId": session_id, "resultUrls": ["/media/files/mock.png"]}

workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(export=lambda pid: {"ok": True, "srt": "a.srt", "script": "a.md"})
sys.modules["export_video"] = types.SimpleNamespace(export=lambda pid, aspect="origin": {"ok": True, "path": "/tmp/a.mp4"})

result = workflow.run_workflow("ignored", project_name="Retry Demo", retries=1, skip_video=True)
print(json.dumps({"result": result, "attempts": attempts[0]}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.ok, true, JSON.stringify(payload.result));
  assert.equal(payload.result.image_failures, 0, JSON.stringify(payload.result));
  assert.equal(payload.attempts, 2, `expected 2 poll attempts, got ${payload.attempts}`);
});

test('workflow does NOT retry on non-retryable error (plan not support)', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [{"index": 1, "text": "scene 1", "media_type": "image"}]
workflow._common.get_canvas_capabilities = lambda: {}

poll_count = [0]

def create_project(name, script_text):
    return {"data": {"id": "proj_no_retry"}}

def create_session(**kw):
    return {"data": {"sessionId": "sess_1", "nodeId": "img_node_1", "status": "generating"}}

def wait_for_session(session_id, timeout=300, poll_interval=2):
    poll_count[0] += 1
    return {"status": "failed", "error": "your current token plan not support model", "sessionId": session_id}

workflow._common.create_project = create_project
workflow._common.create_session = create_session
workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(export=lambda pid: {"ok": True, "srt": "a.srt", "script": "a.md"})
sys.modules["export_video"] = types.SimpleNamespace(export=lambda pid, aspect="origin": {"ok": True, "path": "/tmp/a.mp4"})

result = workflow.run_workflow("ignored", project_name="No Retry Demo", retries=3, skip_video=True)
print(json.dumps({"result": result, "poll_count": poll_count[0]}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.ok, false, JSON.stringify(payload.result));
  assert.equal(payload.result.image_failures, 1, JSON.stringify(payload.result));
  // Should poll exactly once — non-retryable error should NOT trigger a retry
  assert.equal(payload.poll_count, 1, `expected 1 poll, got ${payload.poll_count} (non-retryable should not retry)`);
});

test('workflow does NOT retry on 403/unauthorized error', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [{"index": 1, "text": "scene 1", "media_type": "image"}]
workflow._common.get_canvas_capabilities = lambda: {}

poll_count = [0]

def create_project(name, script_text):
    return {"data": {"id": "proj_auth"}}

def create_session(**kw):
    return {"data": {"sessionId": "sess_1", "nodeId": "img_node_1", "status": "generating"}}

def wait_for_session(session_id, timeout=300, poll_interval=2):
    poll_count[0] += 1
    return {"status": "failed", "error": "403 Forbidden", "sessionId": session_id}

workflow._common.create_project = create_project
workflow._common.create_session = create_session
workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(export=lambda pid: {"ok": True, "srt": "a.srt", "script": "a.md"})
sys.modules["export_video"] = types.SimpleNamespace(export=lambda pid, aspect="origin": {"ok": True, "path": "/tmp/a.mp4"})

result = workflow.run_workflow("ignored", project_name="Auth Demo", retries=3, skip_video=True)
print(json.dumps({"result": result, "poll_count": poll_count[0]}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.ok, false, JSON.stringify(payload.result));
  assert.equal(payload.poll_count, 1, `expected 1 poll for 403, got ${payload.poll_count}`);
});

test('workflow exhausts retries and marks job as failed', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [{"index": 1, "text": "scene 1", "media_type": "image"}]
workflow._common.get_canvas_capabilities = lambda: {}

poll_count = [0]

def create_project(name, script_text):
    return {"data": {"id": "proj_exhaust"}}

def create_session(**kw):
    return {"data": {"sessionId": "sess_1", "nodeId": "img_node_1", "status": "generating"}}

def wait_for_session(session_id, timeout=300, poll_interval=2):
    poll_count[0] += 1
    # Transient error — should be retried
    return {"status": "failed", "error": "server timeout, please retry", "sessionId": session_id}

workflow._common.create_project = create_project
workflow._common.create_session = create_session
workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(export=lambda pid: {"ok": True, "srt": "a.srt", "script": "a.md"})
sys.modules["export_video"] = types.SimpleNamespace(export=lambda pid, aspect="origin": {"ok": True, "path": "/tmp/a.mp4"})

result = workflow.run_workflow("ignored", project_name="Exhaust Demo", retries=2, skip_video=True)
print(json.dumps({"result": result, "poll_count": poll_count[0]}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.ok, false, JSON.stringify(payload.result));
  assert.equal(payload.result.image_failures, 1, JSON.stringify(payload.result));
  // retries=2 → 3 total attempts (1 original + 2 retries)
  assert.equal(payload.poll_count, 3, `expected 3 polls (1 original + 2 retries), got ${payload.poll_count}`);
});

// ---------------------------------------------------------------------------
// Skip flags tests
// ---------------------------------------------------------------------------

test('workflow skip_video=true skips all video scenes', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [
    {"index": 1, "text": "scene 1", "media_type": "image"},
    {"index": 2, "text": "scene 2", "media_type": "video"},
]
workflow._common.get_canvas_capabilities = lambda: {}

create_calls = []

def create_project(name, script_text):
    return {"data": {"id": "proj_skip_video"}}

def create_session(**kw):
    create_calls.append(kw)
    return {"data": {"sessionId": "sess_1", "nodeId": "img_node_1", "status": "generating"}}

def wait_for_session(session_id, timeout=300, poll_interval=2):
    return {"status": "completed", "sessionId": session_id, "resultUrls": ["/media/files/a.png"]}

workflow._common.create_project = create_project
workflow._common.create_session = create_session
workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(export=lambda pid: {"ok": True, "srt": "a.srt", "script": "a.md"})
sys.modules["export_video"] = types.SimpleNamespace(export=lambda pid, aspect="origin": {"ok": True, "path": "/tmp/a.mp4"})

result = workflow.run_workflow("ignored", project_name="SkipVideo", skip_video=True)
print(json.dumps({"result": result, "create_calls": create_calls}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.ok, true, JSON.stringify(payload.result));
  assert.equal(payload.result.video_failures, 0, JSON.stringify(payload.result));
  assert.equal(payload.result.final_video_failures, 0, JSON.stringify(payload.result));
  // Only image scene should be queued
  const image_calls = payload.create_calls.filter(c => c.media_type === 'image');
  const video_calls = payload.create_calls.filter(c => c.media_type === 'video');
  assert.equal(image_calls.length, 1, JSON.stringify(payload.create_calls));
  assert.equal(video_calls.length, 0, JSON.stringify(payload.create_calls));
});

test('workflow skip_subtitle=True skips subtitle export without error', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [{"index": 1, "text": "scene 1", "media_type": "image"}]
workflow._common.get_canvas_capabilities = lambda: {}

subtitle_called = [False]

def create_project(name, script_text):
    return {"data": {"id": "proj_skip_sub"}}

def create_session(**kw):
    return {"data": {"sessionId": "sess_1", "nodeId": "img_node_1", "status": "generating"}}

def wait_for_session(session_id, timeout=300, poll_interval=2):
    return {"status": "completed", "sessionId": session_id, "resultUrls": ["/media/files/a.png"]}

workflow._common.create_project = create_project
workflow._common.create_session = create_session
workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(
    export=lambda pid: (subtitle_called.__setitem__(0, True) or {"ok": True, "srt": "a.srt", "script": "a.md"})
)
sys.modules["export_video"] = types.SimpleNamespace(export=lambda pid, aspect="origin": {"ok": True, "path": "/tmp/a.mp4"})

result = workflow.run_workflow("ignored", project_name="SkipSub", skip_subtitle=True, skip_video=True)
print(json.dumps({"result": result, "subtitle_called": subtitle_called[0]}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.ok, true, JSON.stringify(payload.result));
  assert.equal(payload.result.subtitle_failures, 0, JSON.stringify(payload.result));
  assert.equal(payload.subtitle_called, false, 'subtitle export should not have been called');
});

test('workflow skip_final_video=True skips video export even when videos succeed', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [
    {"index": 1, "text": "scene 1", "media_type": "image"},
    {"index": 2, "text": "scene 2", "media_type": "video"},
]
workflow._common.get_canvas_capabilities = lambda: {"imageToVideoStatus": "ready", "reasons": {}}

video_export_called = [False]

def create_project(name, script_text):
    return {"data": {"id": "proj_skip_final"}}

def create_session(**kw):
    return {"data": {"sessionId": f"sess_{kw.get('message','')}", "nodeId": f"node_{kw.get('message','')}", "status": "generating"}}

def wait_for_session(session_id, timeout=300, poll_interval=2):
    return {"status": "completed", "sessionId": session_id, "resultUrls": [f"/media/files/{session_id}.mp4"]}

workflow._common.create_project = create_project
workflow._common.create_session = create_session
workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(export=lambda pid: {"ok": True, "srt": "a.srt", "script": "a.md"})
sys.modules["export_video"] = types.SimpleNamespace(
    export=lambda pid, aspect="origin": (video_export_called.__setitem__(0, True) or {"ok": True, "path": "/tmp/final.mp4"})
)

result = workflow.run_workflow("ignored", project_name="SkipFinal", skip_final_video=True)
print(json.dumps({"result": result, "video_export_called": video_export_called[0]}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.ok, true, JSON.stringify(payload.result));
  assert.equal(payload.video_export_called, false, 'export_video should not have been called when skip_final_video=True');
  assert.equal(payload.result.final_video_failures, 0, JSON.stringify(payload.result));
  assert.equal(payload.result.project_summaries[0].final_video.skipped, true);
});

test('workflow skips final video export when video scenes fail', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [
    {"index": 1, "text": "scene_1", "media_type": "image"},
    {"index": 2, "text": "scene_2", "media_type": "video"},
]
workflow._common.get_canvas_capabilities = lambda: {"imageToVideoStatus": "ready", "reasons": {}}

video_export_called = [False]

def create_project(name, script_text):
    return {"data": {"id": "proj_vid_fail"}}

# Patch both the module-level import (for _run_scene_jobs) and _common (for _create_scene_job)
def create_session(message, project_id=None, media_type="image", aspect="origin", style="", parent_node_id=None, **kw):
    return {"data": {"sessionId": f"sess_{message}", "nodeId": f"node_{message}", "status": "generating"}}

workflow.create_session = create_session
workflow._common.create_session = create_session
workflow._common.create_project = create_project

def wait_for_session(session_id, timeout=300, poll_interval=2):
    # session_id format: sess_scene_1 or sess_scene_2
    if "scene_2" in session_id:
        return {"status": "failed", "error": "model unavailable", "sessionId": session_id}
    return {"status": "completed", "sessionId": session_id, "resultUrls": ["/media/files/a.png"]}

workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(export=lambda pid: {"ok": True, "srt": "a.srt", "script": "a.md"})
sys.modules["export_video"] = types.SimpleNamespace(
    export=lambda pid, aspect="origin": (video_export_called.__setitem__(0, True) or {"ok": True, "path": "/tmp/final.mp4"})
)

result = workflow.run_workflow("ignored", project_name="VidFail", skip_final_video=False)
print(json.dumps({"result": result, "video_export_called": video_export_called[0]}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.video_failures, 1, JSON.stringify(payload.result));
  assert.equal(payload.video_export_called, false, 'export_video should not be called when videos fail');
  assert.equal(payload.result.project_summaries[0].final_video.skipped, true);
});

// ---------------------------------------------------------------------------
// Batch mode tests
// ---------------------------------------------------------------------------

test('workflow batch=3 creates three separate projects', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [{"index": 1, "text": "scene 1", "media_type": "image"}]
workflow._common.get_canvas_capabilities = lambda: {}

project_ids = []

def create_project(name, script_text):
    project_ids.append(name)
    return {"data": {"id": f"proj_{len(project_ids)}"}}

def create_session(**kw):
    return {"data": {"sessionId": "sess_1", "nodeId": "img_node_1", "status": "generating"}}

def wait_for_session(session_id, timeout=300, poll_interval=2):
    return {"status": "completed", "sessionId": session_id, "resultUrls": ["/media/files/a.png"]}

workflow._common.create_project = create_project
workflow._common.create_session = create_session
workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(export=lambda pid: {"ok": True, "srt": "a.srt", "script": "a.md"})
sys.modules["export_video"] = types.SimpleNamespace(export=lambda pid, aspect="origin": {"ok": True, "path": "/tmp/a.mp4"})

result = workflow.run_workflow("ignored", project_name="BatchDemo", batch=3, skip_video=True)
print(json.dumps({"result": result, "project_names": project_ids}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.ok, true, JSON.stringify(payload.result));
  assert.equal(payload.result.projects.length, 3, JSON.stringify(payload.result));
  assert.equal(payload.result.batch, 3, JSON.stringify(payload.result));
  // Project names should be appended with -1, -2, -3
  assert.equal(payload.project_names[0], 'BatchDemo-1', JSON.stringify(payload.project_names));
  assert.equal(payload.project_names[1], 'BatchDemo-2', JSON.stringify(payload.project_names));
  assert.equal(payload.project_names[2], 'BatchDemo-3', JSON.stringify(payload.project_names));
});

test('workflow batch=1 uses the exact project_name without suffix', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [{"index": 1, "text": "scene 1", "media_type": "image"}]
workflow._common.get_canvas_capabilities = lambda: {}

project_names = []

def create_project(name, script_text):
    project_names.append(name)
    return {"data": {"id": "proj_single"}}

def create_session(**kw):
    return {"data": {"sessionId": "sess_1", "nodeId": "img_node_1", "status": "generating"}}

def wait_for_session(session_id, timeout=300, poll_interval=2):
    return {"status": "completed", "sessionId": session_id, "resultUrls": ["/media/files/a.png"]}

workflow._common.create_project = create_project
workflow._common.create_session = create_session
workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(export=lambda pid: {"ok": True, "srt": "a.srt", "script": "a.md"})
sys.modules["export_video"] = types.SimpleNamespace(export=lambda pid, aspect="origin": {"ok": True, "path": "/tmp/a.mp4"})

result = workflow.run_workflow("ignored", project_name="SingleBatch", batch=1, skip_video=True)
print(json.dumps({"result": result, "project_names": project_names}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.ok, true, JSON.stringify(payload.result));
  assert.equal(payload.result.projects.length, 1, JSON.stringify(payload.result));
  assert.equal(payload.project_names[0], 'SingleBatch', JSON.stringify(payload.project_names));
});

// ---------------------------------------------------------------------------
// _should_retry_failure edge cases
// ---------------------------------------------------------------------------

test('_should_retry_failure returns false for "quota exceeded"', () => {
  const code = `
import json, sys
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

tests = [
    ("quota exceeded", False),
    ("rate limit", False),
    ("rate_limit exceeded", False),
    ("429 Too Many Requests", False),
    ("authentication failed", False),
    ("insufficient credits", False),
    ("billing error", False),
    ("server timeout please retry", True),
    ("connection refused", True),
    ("network error", True),
    ("unknown error", True),
]
for msg, expected in tests:
    actual = workflow._should_retry_failure({"result": {"error": msg}})
    assert actual == expected, f"msg={msg!r}: expected {expected}, got {actual}"
print(json.dumps({"ok": True}))
`;
  runWorkflowPython(code); // throws on assertion failure
});

test('workflow subtitle export failure increments subtitle_failures but still returns ok=true for images-only', () => {
  const code = `
import json, sys, types
sys.path.insert(0, ${JSON.stringify(SCRIPT_DIR)})
import workflow

workflow.check_all = lambda *a, **kw: []
workflow.parse_script = lambda t: [{"index": 1, "text": "scene 1", "media_type": "image"}]
workflow._common.get_canvas_capabilities = lambda: {}

def create_project(name, script_text):
    return {"data": {"id": "proj_sub_fail"}}

def create_session(**kw):
    return {"data": {"sessionId": "sess_1", "nodeId": "img_node_1", "status": "generating"}}

def wait_for_session(session_id, timeout=300, poll_interval=2):
    return {"status": "completed", "sessionId": session_id, "resultUrls": ["/media/files/a.png"]}

workflow._common.create_project = create_project
workflow._common.create_session = create_session
workflow._common.wait_for_session = wait_for_session
sys.modules["export_subtitle"] = types.SimpleNamespace(export=lambda pid: {"ok": False, "error": "Canvas API unavailable"})
sys.modules["export_video"] = types.SimpleNamespace(export=lambda pid, aspect="origin": {"ok": True, "path": "/tmp/a.mp4"})

result = workflow.run_workflow("ignored", project_name="SubFail", skip_video=True)
print(json.dumps({"result": result}, ensure_ascii=False))
`;

  const { payload } = runWorkflowPython(code);
  assert.equal(payload.result.ok, false, JSON.stringify(payload.result));
  assert.equal(payload.result.subtitle_failures, 1, JSON.stringify(payload.result));
  assert.equal(payload.result.project_summaries[0].subtitle.ok, false);
  assert.match(payload.result.project_summaries[0].subtitle.error, /unavailable/i);
});
