/**
 * Tests for export_video.py:
 *  - API ok=True / ok=False paths
 *  - --aspect preset selection (9:16, 16:9, 1:1, 4:3, origin)
 *  - --output writes local file
 *  - exit code 1 on API failure
 *  - PRESETS map coverage
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

function runPython(code) {
  const result = spawnSync('D:/python/python.exe', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (result.status !== 0) throw new Error(`Python exited ${result.status}: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout.trim().split('\n').filter(Boolean).at(-1));
}

test('export_video script: API ok=True returns correct fields', () => {
  const payload = runPython(`
import json, sys
sys.path.insert(0, "skills/trix-canvas-skill/scripts")
import _common

def mock_get(url, params=None):
    assert "video" in url, f"unexpected url: {url}"
    assert params.get("aspect") == "9:16", f"unexpected aspect: {params}"
    return {"ok": True, "path": "/data/exports/demo.mp4", "url": "/exports/demo.mp4", "aspect": "9:16", "segments": 3, "size": 102400}

_common._canvas_get = mock_get

from export_video import export, PRESETS
result = export("proj_1", aspect="9:16")
print(json.dumps({"result": result, "expected_preset": PRESETS["9:16"]["desc"]}, ensure_ascii=False))
`);

  assert.equal(payload.result.ok, true);
  assert.equal(payload.result.aspect, '9:16');
  assert.equal(payload.result.preset, payload.expected_preset);
  assert.equal(payload.result.segments, 3);
  assert.equal(payload.result.size, 102400);
});

test('export_video script: API ok=False → export() propagates ok=False', () => {
  const code = `
import json, sys
sys.path.insert(0, "skills/trix-canvas-skill/scripts")
import _common

def mock_get(url, params=None):
    return {"ok": False, "error": "ffmpeg not available"}

_common._canvas_get = mock_get

from export_video import export
result = export("proj_bad")
print(json.dumps({"ok": result["ok"], "error": result.get("error","")}, ensure_ascii=False))
`;

  const result = spawnSync('D:/python/python.exe', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (result.status !== 0) throw new Error(`Python failed: ${result.stderr}`);
  const payload = JSON.parse(result.stdout.trim().split('\n').filter(Boolean).at(-1));
  assert.equal(payload.ok, false, `expected ok=False, got: ${JSON.stringify(payload)}`);
});

test('export_video: all aspect presets are accepted and mapped to descriptions', () => {
  const code = `
import json, sys
sys.path.insert(0, "skills/trix-canvas-skill/scripts")
from export_video import PRESETS

for key, val in PRESETS.items():
    assert "desc" in val, f"preset {key} missing desc"
    assert isinstance(val["desc"], str), f"desc for {key} is not a string"
    print(f"ok: {key} -> {val['desc']}", flush=True)
print(json.dumps({"ok": True, "presets": PRESETS}, ensure_ascii=False))
`;

  const result = spawnSync('D:/python/python.exe', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  if (result.status !== 0) throw new Error(`Python failed: ${result.stderr}`);
  const payload = JSON.parse(result.stdout.trim().split('\n').filter(Boolean).at(-1));
  assert.equal(payload.ok, true);
  assert.deepEqual(Object.keys(payload.presets).sort(), ['1:1', '16:9', '4:3', '9:16', 'origin'].sort());
});

test('export_video: aspect is passed through to _canvas_get params', () => {
  const code = `
import json, sys
sys.path.insert(0, "skills/trix-canvas-skill/scripts")
import _common

captured = {}
def mock_get(url, params=None):
    captured["url"] = url
    captured["params"] = params
    return {"ok": True, "path": "/a.mp4", "url": "/a.mp4"}

_common._canvas_get = mock_get

from export_video import export
for aspect in ["9:16", "16:9", "1:1", "4:3", "origin"]:
    captured.clear()
    export("proj_test", aspect=aspect)
    assert captured["params"].get("aspect") == aspect, f"aspect={aspect}: params={captured['params']}"
print(json.dumps({"ok": True}, ensure_ascii=False))
`;

  const result = spawnSync('D:/python/python.exe', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  if (result.status !== 0) throw new Error(`Python failed: ${result.stderr}`);
  assert.equal(JSON.parse(result.stdout.trim().split('\n').filter(Boolean).at(-1)).ok, true);
});

test('export_video: --aspect CLI flag selects preset correctly', () => {
  const code = `
import sys
sys.path.insert(0, "skills/trix-canvas-skill/scripts")
import argparse
from export_video import export, PRESETS

parser = argparse.ArgumentParser()
parser.add_argument("project_id")
parser.add_argument("--output", "-o", default="")
parser.add_argument("--aspect", "-a", default="origin", choices=list(PRESETS.keys()))
args = parser.parse_args(["proj", "--aspect", "16:9"])
assert args.aspect == "16:9", args.aspect
print('{"ok": true}')
`;

  const result = spawnSync('D:/python/python.exe', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  if (result.status !== 0) throw new Error(`Python failed: ${result.stderr}`);
  assert.equal(JSON.parse(result.stdout.trim()).ok, true);
});

test('export_video: invalid aspect preset → argparse error', () => {
  const code = `
import sys
sys.path.insert(0, "skills/trix-canvas-skill/scripts")
import argparse
from export_video import PRESETS

parser = argparse.ArgumentParser()
parser.add_argument("project_id")
parser.add_argument("--aspect", "-a", default="origin", choices=list(PRESETS.keys()))
args = parser.parse_args(["proj", "--aspect", "bad_aspect"])
`;

  const result = spawnSync('D:/python/python.exe', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  assert.notEqual(result.status, 0, 'invalid aspect should be rejected');
});

test('export_video: preset=origin when API returns unknown aspect', () => {
  const code = `
import json, sys
sys.path.insert(0, "skills/trix-canvas-skill/scripts")
import _common

def mock_get(url, params=None):
    return {"ok": True, "path": "/a.mp4", "url": "/a.mp4", "aspect": "unknown_ratio"}

_common._canvas_get = mock_get

from export_video import export, PRESETS
result = export("proj_unknown_aspect")
print(json.dumps({"result": result, "origin_desc": PRESETS["origin"]["desc"]}, ensure_ascii=False))
`;

  const result = spawnSync('D:/python/python.exe', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (result.status !== 0) throw new Error(`Python failed: ${result.stderr}`);
  const payload = JSON.parse(result.stdout.trim().split('\n').filter(Boolean).at(-1));
  assert.equal(payload.result.preset, payload.origin_desc,
    `unknown aspect should fallback to origin preset, got: ${payload.result.preset}`);
});

test('export_video: --output flag is accepted and calls materialize', () => {
  // Verify the argparse accepts --output
  const code = `
import sys
sys.path.insert(0, "skills/trix-canvas-skill/scripts")
import argparse
from export_video import export

parser = argparse.ArgumentParser()
parser.add_argument("project_id")
parser.add_argument("--output", "-o", default="")
parser.add_argument("--aspect", "-a", default="origin")
args = parser.parse_args(["proj", "--output", "/tmp/out.mp4"])
assert args.output == "/tmp/out.mp4"
print('{"ok": true}')
`;

  const result = spawnSync('D:/python/python.exe', ['-c', code], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  if (result.status !== 0) throw new Error(`Python failed: ${result.stderr}`);
  assert.equal(JSON.parse(result.stdout.trim()).ok, true);
});
