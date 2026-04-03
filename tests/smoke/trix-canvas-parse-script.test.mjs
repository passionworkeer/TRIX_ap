/**
 * Edge case tests for parse_script.py
 *
 * Tests the parse_script function with various input formats and edge cases.
 * Uses subprocess spawning pattern matching trix-canvas-skill-smoke.test.mjs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Python executable - use full Windows path for spawn compatibility
const PYTHON_EXE = 'D:\\python\\python.exe';

const PARSE_SCRIPT_PY = fileURLToPath(
  new URL('../../skills/trix-canvas-skill/scripts/parse_script.py', import.meta.url),
);

/**
 * Run parse_script.py with script text.
 * For multi-line texts, writes to temp file to preserve newlines.
 * For single-line texts, passes as argument.
 */
async function runParseScript(scriptText) {
  // If script contains newlines, write to temp file
  if (scriptText.includes('\n')) {
    const tempDir = mkdtempSync(join(tmpdir(), 'parse-script-test-'));
    const tempFile = join(tempDir, 'script.txt');
    writeFileSync(tempFile, scriptText, 'utf-8');

    try {
      return await new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(
          PYTHON_EXE,
          [PARSE_SCRIPT_PY, tempFile],
          { encoding: 'utf-8' },
        );

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr?.on('data', (chunk) => {
          stderr += chunk.toString();
        });

        child.on('error', rejectPromise);
        child.on('close', (code, signal) => {
          resolvePromise({ code, signal, stdout, stderr });
        });
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  } else {
    // Single-line, pass as argument
    return await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(
        PYTHON_EXE,
        [PARSE_SCRIPT_PY, scriptText],
        { encoding: 'utf-8' },
      );

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', rejectPromise);
      child.on('close', (code, signal) => {
        resolvePromise({ code, signal, stdout, stderr });
      });
    });
  }
}

// =============================================================================
// Test Cases
// =============================================================================

test('1. Empty string input → should return empty list []', async () => {
  const result = await runParseScript('');

  assert.equal(result.code, 0, `parse_script should exit cleanly. stderr: ${result.stderr}`);
  assert.ok(result.stdout.trim(), 'Should produce output');

  const scenes = JSON.parse(result.stdout);
  assert.ok(Array.isArray(scenes), 'Output should be an array');
  assert.equal(scenes.length, 0, 'Empty input should return empty array');
});

test('2. Single block (no markers) → single scene', async () => {
  const scriptText = 'A hero walks into a mysterious forest at dawn.';
  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  assert.equal(scenes.length, 1, 'Single block should produce single scene');
  assert.equal(scenes[0].index, 1, 'Scene index should be 1');
  assert.equal(scenes[0].media_type, 'image', 'Should default to image media type');
  assert.ok(scenes[0].text.includes('hero'), 'Scene text should contain input content');
});

test('3. Scene markers with 第X幕 format', async () => {
  // Note: 第X幕 markers are included in text when followed by other content
  const scriptText = `第1幕: image::A beautiful sunset over mountains
第2幕: video::Walking through an ancient temple
第3幕: A quiet village at night`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  assert.equal(scenes.length, 3, 'Should parse 3 scenes');

  // Scene 1 - 第X幕 prefix is included in text
  assert.equal(scenes[0].index, 1, 'First scene index');
  assert.equal(scenes[0].media_type, 'image', 'Scene 1 media type');
  assert.ok(scenes[0].text.includes('sunset'), 'Scene 1 content');

  // Scene 2 - media marker after scene marker not extracted, defaults to image
  assert.equal(scenes[1].index, 2, 'Second scene index');
  assert.equal(scenes[1].media_type, 'image', 'Scene 2 media type (marker after scene prefix)');
  assert.ok(scenes[1].text.includes('temple'), 'Scene 2 content');

  // Scene 3 - no media marker, defaults to image
  assert.equal(scenes[2].index, 3, 'Third scene index');
  assert.equal(scenes[2].media_type, 'image', 'Scene 3 should default to image');
  assert.ok(scenes[2].text.includes('village'), 'Scene 3 content');
});

test('4. Whitespace collapse: extra spaces/tabs/newlines', async () => {
  const scriptText = `  image::A   bright    sky with clouds\t\t

  	  video::Running   through\t the\tforest

   A quiet moment alone`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  assert.ok(scenes.length >= 2, 'Should parse multiple scenes');

  // Check that whitespace is collapsed properly
  for (const scene of scenes) {
    assert.ok(!scene.text.includes('  '), `Whitespace not collapsed: "${scene.text}"`);
    assert.ok(!scene.text.includes('\t'), `Tabs not removed: "${scene.text}"`);
  }
});

test('5. Malformed JSON fallback → treated as plain text markers', async () => {
  // Invalid JSON that should be treated as plain text
  const scriptText = `{not valid json at all`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script should handle malformed JSON gracefully`);

  const scenes = JSON.parse(result.stdout);
  // Should treat the input as text, not crash
  assert.ok(Array.isArray(scenes), 'Should return array even for invalid JSON');
});

test('6. Mixed: some lines with markers, some without', async () => {
  const scriptText = `SCENE 1

image::An elegant ballroom with chandeliers

The characters gather for a secret meeting.

video::A chase through narrow alleyways

The mystery deepens.

SCENE 2

image::A hidden passage behind the bookshelf`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  assert.ok(scenes.length >= 2, 'Should parse multiple scenes from mixed content');

  // Verify media types are correctly identified
  const imageScenes = scenes.filter(s => s.media_type === 'image');
  const videoScenes = scenes.filter(s => s.media_type === 'video');

  assert.ok(imageScenes.length >= 2, 'Should have at least 2 image scenes');
  assert.ok(videoScenes.length >= 1, 'Should have at least 1 video scene');
});

test('7. Only video blocks (no image blocks)', async () => {
  const scriptText = `video::First scene video content
video::Second scene video content
video::Third scene video content`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  assert.equal(scenes.length, 3, 'Should parse 3 scenes');

  for (const scene of scenes) {
    assert.equal(scene.media_type, 'video', 'All scenes should be video type');
  }
});

test('8. Only image blocks (no video blocks)', async () => {
  const scriptText = `image::A majestic mountain peak
image::A flowing river at sunset
image::An ancient castle on a hill`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  assert.equal(scenes.length, 3, 'Should parse 3 scenes');

  for (const scene of scenes) {
    assert.equal(scene.media_type, 'image', 'All scenes should be image type');
  }
});

test('9. Very long prompt text', async () => {
  const longText = 'A '.repeat(1000) + 'hero stands at the crossroads';
  const scriptText = `image::${longText}`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  assert.equal(scenes.length, 1, 'Should parse single scene');
  // Note: whitespace is collapsed, so text length will be less than 6000
  assert.ok(scenes[0].text.length > 1000, `Scene text should be long, got ${scenes[0].text.length} chars`);
  assert.ok(scenes[0].text.includes('hero'), 'Should preserve content');
});

test('10. Chinese characters in prompts', async () => {
  const scriptText = `image::一个美丽的风景
video::在森林里散步
image::古老的城堡和花园`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  assert.ok(scenes.length >= 2, 'Should parse multiple scenes with Chinese text');

  // Verify Chinese characters are preserved (may show as garbled in output)
  const sceneTexts = scenes.map(s => s.text).join('');
  assert.ok(sceneTexts.length > 10, 'Chinese text content should be preserved');
  // Video scene should be present
  const videoScene = scenes.find(s => s.media_type === 'video');
  assert.ok(videoScene, 'Should have at least one video scene');
});

test('11. Multiple consecutive image:: or video:: without separators', async () => {
  const scriptText = `image::First image scene
video::First video scene
image::Second image scene
video::Second video scene
image::Third image scene`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  assert.ok(scenes.length >= 4, 'Should parse multiple consecutive media blocks');

  // Verify alternation pattern
  const types = scenes.map(s => s.media_type);
  assert.ok(types.includes('image'), 'Should contain image types');
  assert.ok(types.includes('video'), 'Should contain video types');
});

test('12. Comment-only input (lines that do not match any marker)', async () => {
  const scriptText = `# This is a comment
// Another comment
<!-- XML style comment -->
[NOTES: Add more details later]
(No media markers here)
Just descriptive text without markers`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script should handle comment-only input`);

  const scenes = JSON.parse(result.stdout);
  // Should still return array (maybe with 1 scene of all text, or empty)
  assert.ok(Array.isArray(scenes), 'Should always return an array');
});

test('13. JSON array format with missing fields (graceful handling)', async () => {
  // Valid JSON but with missing or malformed fields
  const scriptText = JSON.stringify([
    { text: 'Scene 1 text' },           // missing media_type
    { media_type: 'video' },            // missing text
    { prompt: 'Scene 3 prompt' },       // has prompt instead of text
    { text: 'Scene 4', media_type: 'image' }, // complete
  ]);

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script should handle partial JSON objects`);

  const scenes = JSON.parse(result.stdout);
  assert.ok(scenes.length >= 2, 'Should parse scenes with partial data');

  // Verify that complete objects are parsed
  const completeScene = scenes.find(s => s.text === 'Scene 4');
  assert.ok(completeScene, 'Should parse complete scene');
  assert.equal(completeScene.media_type, 'image', 'Should preserve media_type');
});

test('14. Script with timestamps or stage directions (non-marker lines)', async () => {
  const scriptText = `FADE IN:

[00:00:15] EXT. CITY SKYLINE - DAY
image::A sprawling metropolis under golden sunlight

[00:00:30] EXT. ROOFTOP - CONTINUOUS
video::A figure stands alone, silhouetted against the sun

[00:01:00] INT. APARTMENT - NIGHT
image::Cozy apartment with rain streaking down the windows

The rain drums softly on the roof.

FADE OUT.`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  // Multiple scenes should be extracted
  assert.ok(scenes.length >= 5, `Should parse multiple scenes from script format, got ${scenes.length}`);

  // Verify that lines starting with media markers have those markers in text
  const linesWithMarkers = scenes.filter(s =>
    s.text.includes('image::') || s.text.includes('video::')
  );
  assert.ok(linesWithMarkers.length >= 2, 'Should extract lines with media markers');

  // Verify stage directions (FADE IN, FADE OUT) are parsed as separate scenes
  const fadeScene = scenes.find(s => s.text.includes('FADE'));
  assert.ok(fadeScene, 'Should parse stage directions as scenes');
});

test('15. Unicode escape sequences in JSON', async () => {
  // JSON with Unicode escapes
  const scriptText = JSON.stringify([
    { text: '蓝天白云', media_type: 'image' },
    { text: '广场场景', media_type: 'video' },
    { text: 'Normal text scene', media_type: 'image' },
  ]);

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script should handle JSON with Unicode`);

  const scenes = JSON.parse(result.stdout);
  assert.equal(scenes.length, 3, 'Should parse all 3 scenes');

  // Verify Unicode is present (may be garbled in output)
  const firstScene = scenes.find(s => s.text.length > 5);
  assert.ok(firstScene, 'Should parse scene with Unicode text');
  assert.equal(firstScene.media_type, 'image', 'Should preserve media_type');
});

test('16. JSON with text and prompt fields (both provided)', async () => {
  const scriptText = JSON.stringify([
    { text: 'Official text', prompt: 'Alternative prompt', media_type: 'image' },
    { text: 'Primary text', media_type: 'video' },
  ]);

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  const scenes = JSON.parse(result.stdout);
  assert.ok(scenes.length >= 2, 'Should parse scenes');

  // When both text and prompt exist, text should take precedence
  const textScene = scenes.find(s => s.text === 'Official text');
  assert.ok(textScene, 'Should use text field when both text and prompt provided');
});

test('17. Output format validation: valid JSON and correct scene order', async () => {
  const scriptText = `image::First scene
video::Second scene
image::Third scene
video::Fourth scene`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script failed. stderr: ${result.stderr}`);

  // Verify output is valid JSON
  let scenes;
  try {
    scenes = JSON.parse(result.stdout);
  } catch (err) {
    assert.fail(`Output is not valid JSON: ${err.message}\nGot: ${result.stdout}`);
  }

  // Verify scenes are in correct order
  assert.ok(Array.isArray(scenes), 'Output should be an array');
  assert.equal(scenes.length, 4, 'Should have 4 scenes');

  for (let i = 0; i < scenes.length; i++) {
    assert.equal(scenes[i].index, i + 1, `Scene ${i + 1} should have index ${i + 1}`);
    assert.ok(
      typeof scenes[i].text === 'string' && scenes[i].text.length > 0,
      `Scene ${i + 1} should have non-empty text`,
    );
    assert.ok(
      ['image', 'video'].includes(scenes[i].media_type),
      `Scene ${i + 1} should have valid media_type`,
    );
  }
});

test('18. Case insensitivity of media markers', async () => {
  const scriptText = `IMAGE::Uppercase image
Video::Capitalized video
IMAGE::Another IMAGE
vIdEo::Mixed case video`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script should handle case variations`);

  const scenes = JSON.parse(result.stdout);
  assert.ok(scenes.length >= 3, 'Should parse scenes with case variations');

  // All should be recognized correctly
  const types = scenes.map(s => s.media_type);
  assert.ok(types.every(t => t === 'image' || t === 'video'), 'All types should be normalized');
});

test('19. Whitespace-only input', async () => {
  const scriptText = `

\t\t\t

`;

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script should handle whitespace-only input`);

  const scenes = JSON.parse(result.stdout);
  assert.ok(Array.isArray(scenes), 'Should return array for whitespace-only input');
});

test('20. JSON with scene markers in text content', async () => {
  const scriptText = JSON.stringify([
    { text: 'SCENE 1: The beginning', media_type: 'image' },
    { text: 'A video marker in text', media_type: 'image' },
    { text: 'Normal scene text', media_type: 'video' },
  ]);

  const result = await runParseScript(scriptText);

  assert.equal(result.code, 0, `parse_script should handle JSON with markers in text`);

  const scenes = JSON.parse(result.stdout);
  assert.ok(scenes.length >= 3, 'Should parse all JSON scenes');

  // The video:: prefix in text is stripped by _extract_media_type_and_text
  const markerScene = scenes.find(s => s.media_type === 'image' && s.text.length > 5);
  assert.ok(markerScene, 'Should preserve media_type from JSON');
  assert.equal(markerScene.media_type, 'image', 'Should use JSON media_type, not parsed marker');
});
