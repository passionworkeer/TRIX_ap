import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const INSTALL_SCRIPT = resolve(REPO_ROOT, 'skills/trix-canvas-skill/scripts/install_openclaw_skill.py');
const STRICT_SYNC = /^(1|true|yes)$/i.test(process.env.TRIX_STRICT_SKILL_RUNTIME_SYNC || '');

function sha1(filePath) {
  return createHash('sha1').update(readFileSync(filePath)).digest('hex');
}

test('trix-canvas skill install smoke', async (t) => {
  const workspace = mkdtempSync(join(tmpdir(), 'trix-openclaw-workspace-'));

  try {
    const PY = 'D:/python/python.exe';
    const install = spawnSync(
      PY,
      [INSTALL_SCRIPT, '--workspace', workspace],
      { cwd: REPO_ROOT, encoding: 'utf-8' },
    );
    assert.equal(install.status, 0, install.stderr || install.stdout);

    const payload = JSON.parse(install.stdout.trim());
    assert.equal(payload.ok, true, `install output: ${install.stdout}`);

    const skillDir = resolve(workspace, 'skills/trix-canvas-skill');
    assert.equal(existsSync(skillDir), true, `missing skill dir: ${skillDir}`);
    assert.equal(existsSync(resolve(skillDir, 'SKILL.md')), true);
    assert.equal(existsSync(resolve(skillDir, 'scripts/start_canvas.py')), true);
    assert.equal(existsSync(resolve(skillDir, 'scripts/install_openclaw_skill.py')), true);
    assert.equal(existsSync(resolve(skillDir, 'assets/canvas-service/canvasSecurity.js')), true);
    assert.equal(existsSync(resolve(skillDir, 'assets/canvas-service/server.js')), true);
    assert.equal(existsSync(resolve(skillDir, 'assets/canvas-service/public/canvas.html')), true);
    assert.equal(
      existsSync(resolve(skillDir, 'assets/canvas-service/public/canvas.html.bak')),
      false,
      'backup-only canvas.html.bak should not be packaged into the OpenClaw skill',
    );
    assert.equal(
      existsSync(resolve(skillDir, 'assets/canvas-service/public/test.html')),
      false,
      'debug-only test.html should not be packaged into the OpenClaw skill',
    );

    const help = spawnSync(
      PY,
      [resolve(skillDir, 'scripts/start_canvas.py'), '--help'],
      { cwd: REPO_ROOT, encoding: 'utf-8' },
    );
    assert.equal(help.status, 0, help.stderr || help.stdout);

    const installedCanvasHtml = resolve(skillDir, 'assets/canvas-service/public/canvas.html');
    const installedServerJs = resolve(skillDir, 'assets/canvas-service/server.js');
    const repoCanvasHtml = resolve(REPO_ROOT, 'packages/trix-canvas-service/public/canvas.html');
    const repoServerJs = resolve(REPO_ROOT, 'packages/trix-canvas-service/server.js');

    const htmlMatches = sha1(installedCanvasHtml) === sha1(repoCanvasHtml);
    const serverMatches = sha1(installedServerJs) === sha1(repoServerJs);

    if (STRICT_SYNC) {
      assert.equal(htmlMatches, true, 'installed canvas.html differs from repo runtime');
      assert.equal(serverMatches, true, 'installed server.js differs from repo runtime');
    } else {
      t.diagnostic(`runtime_sync(canvas.html)=${htmlMatches}`);
      t.diagnostic(`runtime_sync(server.js)=${serverMatches}`);
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
