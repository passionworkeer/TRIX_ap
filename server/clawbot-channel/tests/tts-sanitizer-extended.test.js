/**
 * Extended tests for TTS text sanitizer service
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeTtsText,
  CODE_BLOCK_PLACEHOLDER,
  INLINE_CODE_PLACEHOLDER,
} = require('../services/ttsTextSanitizer');

test('sanitizeTtsText should handle empty input', () => {
  assert.equal(sanitizeTtsText(''), '');
  assert.equal(sanitizeTtsText(null), '');
  assert.equal(sanitizeTtsText(undefined), '');
  assert.equal(sanitizeTtsText(123), '');
});

test('sanitizeTtsText should preserve plain Chinese text', () => {
  const input = '你好，欢迎来到TRIX世界！';
  const output = sanitizeTtsText(input);
  assert.equal(output, input);
});

test('sanitizeTtsText should replace code blocks', () => {
  const input = '这是一段代码：\n```js\nconst x = 1;\n```\n代码结束';
  const output = sanitizeTtsText(input);

  assert.equal(output.includes('```'), false);
  assert.equal(output.includes('const x = 1'), false);
  assert.equal(output.includes(CODE_BLOCK_PLACEHOLDER), true);
});

test('sanitizeTtsText should replace inline code', () => {
  const input = '使用 `console.log()` 进行调试';
  const output = sanitizeTtsText(input);

  assert.equal(output.includes('`'), false);
  assert.equal(output.includes(INLINE_CODE_PLACEHOLDER), true);
});

test('sanitizeTtsText should strip URLs', () => {
  const cases = [
    {
      input: '访问 https://example.com/docs',
      shouldNotInclude: 'https://example.com',
    },
    {
      input: '查看 www.openclaw.ai',
      shouldNotInclude: 'openclaw.ai',
    },
    {
      input: '点击 <https://link.com>',
      shouldNotInclude: 'link.com',
    },
  ];

  for (const { input, shouldNotInclude } of cases) {
    const output = sanitizeTtsText(input);
    assert.equal(output.includes(shouldNotInclude), false, `Should strip: ${shouldNotInclude}`);
  }
});

test('sanitizeTtsText should strip markdown links but keep labels', () => {
  const input = '查看 [官方文档](https://docs.example.com)';
  const output = sanitizeTtsText(input);

  assert.equal(output.includes('官方文档'), true, 'Should keep link label');
  assert.equal(output.includes('docs.example.com'), false, 'Should strip URL');
});

test('sanitizeTtsText should strip markdown images but keep alt text', () => {
  const input = '![产品截图](https://cdn.example.com/screenshot.png)';
  const output = sanitizeTtsText(input);

  assert.equal(output.includes('产品截图'), true, 'Should keep alt text');
  assert.equal(output.includes('cdn.example.com'), false, 'Should strip URL');
});

test('sanitizeTtsText should handle images without alt text', () => {
  const input = '![](https://example.com/image.png)';
  const output = sanitizeTtsText(input);

  assert.equal(output.includes('图片'), true, 'Should add placeholder for image');
});

test('sanitizeTtsText should strip markdown formatting', () => {
  const input = '# 标题\n**粗体** *斜体* ~~删除线~~';
  const output = sanitizeTtsText(input);

  assert.equal(output.includes('#'), false, 'Should strip heading marker');
  assert.equal(output.includes('*'), false, 'Should strip emphasis markers');
  assert.equal(output.includes('~'), false, 'Should strip strikethrough');
});

test('sanitizeTtsText should strip blockquotes', () => {
  const input = '> 这是一段引用';
  const output = sanitizeTtsText(input);

  assert.equal(output.includes('>'), false);
});

test('sanitizeTtsText should strip list markers', () => {
  const unordered = '- 第一项\n- 第二项';
  const ordered = '1. 第一项\n2. 第二项';

  const unorderedOutput = sanitizeTtsText(unordered);
  const orderedOutput = sanitizeTtsText(ordered);

  assert.equal(unorderedOutput.match(/^-\s/m), null, 'Should strip unordered markers');
  assert.equal(orderedOutput.match(/^\d+\.\s/m), null, 'Should strip ordered markers');
});

test('sanitizeTtsText should enforce max length', () => {
  const longText = '测试文本 '.repeat(100);
  const maxLen = 50;

  const output = sanitizeTtsText(longText, maxLen);

  assert.equal(output.length <= maxLen, true, `Output length ${output.length} should be <= ${maxLen}`);
});

test('sanitizeTtsText should handle CRLF and CR line endings', () => {
  const crlfInput = '第一行\r\n第二行';
  const crInput = '第一行\r第二行';

  const crlfOutput = sanitizeTtsText(crlfInput);
  const crOutput = sanitizeTtsText(crInput);

  assert.equal(crlfOutput.includes('\r\n'), false, 'Should normalize CRLF');
  assert.equal(crOutput.includes('\r'), false, 'Should normalize CR');
});

test('sanitizeTtsText should collapse multiple spaces', () => {
  const input = '多个   空格   应该   合并';
  const output = sanitizeTtsText(input);

  assert.equal(output.includes('   '), false, 'Should collapse multiple spaces');
});

test('sanitizeTtsText should remove control characters', () => {
  const input = '文本\x00\x01\x02内容';
  const output = sanitizeTtsText(input);

  assert.equal(output.includes('\x00'), false);
  assert.equal(output.includes('\x01'), false);
  assert.equal(output.includes('\x02'), false);
});

test('sanitizeTtsText should preserve punctuation', () => {
  const input = '你好！这是测试。问题：答案；解释。';
  const output = sanitizeTtsText(input);

  assert.equal(output.includes('！'), true);
  assert.equal(output.includes('。'), true);
  assert.equal(output.includes('：'), true);
  assert.equal(output.includes('；'), true);
});

test('sanitizeTtsText should handle mixed content correctly', () => {
  const input = `
# API 说明

调用 \`GET /api/users\` 获取用户列表。

示例代码：
\`\`\`javascript
const users = await fetch('/api/users');
console.log(users);
\`\`\`

更多详情请查看 [官方文档](https://docs.example.com)。

![架构图](https://cdn.example.com/arch.png)
`;

  const output = sanitizeTtsText(input, 200);

  // Should strip formatting
  assert.equal(output.includes('#'), false);
  assert.equal(output.includes('```'), false);
  assert.equal(output.includes('`'), false);

  // Should have placeholders
  assert.equal(output.includes(CODE_BLOCK_PLACEHOLDER), true);
  assert.equal(output.includes(INLINE_CODE_PLACEHOLDER), true);

  // Should keep readable text
  assert.equal(output.includes('API'), true);
  assert.equal(output.includes('用户列表'), true);
  assert.equal(output.includes('官方文档'), true);

  // Should be within length limit
  assert.equal(output.length <= 200, true);
});
