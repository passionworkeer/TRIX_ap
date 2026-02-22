const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeTtsText,
  CODE_BLOCK_PLACEHOLDER,
  INLINE_CODE_PLACEHOLDER,
} = require('../services/ttsTextSanitizer');

test('sanitizeTtsText should replace code blocks and strip URLs', () => {
  const input = [
    '这里有一段代码：',
    '```js',
    'const a = 1;',
    'console.log(a);',
    '```',
    '内联 `x + y` 也要处理。',
    '访问 https://example.com/docs 和 www.openclaw.ai',
    '链接 [官方文档](https://openclaw.ai/docs)',
    '图片 ![avatar](https://cdn.example.com/a.png)',
  ].join('\n');

  const output = sanitizeTtsText(input, 500);

  assert.equal(output.includes(CODE_BLOCK_PLACEHOLDER), true);
  assert.equal(output.includes(INLINE_CODE_PLACEHOLDER), true);
  assert.equal(output.includes('https://'), false);
  assert.equal(output.includes('www.openclaw.ai'), false);
  assert.equal(output.includes('`'), false);
  assert.equal(output.includes('官方文档'), true);
});

test('sanitizeTtsText should keep readable text and enforce max length', () => {
  const noisyText = '### 标题 !!! $$$%%%@@@   正文内容   '.repeat(30);
  const output = sanitizeTtsText(noisyText, 80);

  assert.equal(output.length <= 80, true);
  assert.equal(output.length > 0, true);
  assert.equal(output.includes('#'), false);
});
