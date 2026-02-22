const CODE_BLOCK_PLACEHOLDER = '（此处省略一段代码）';
const INLINE_CODE_PLACEHOLDER = '（代码）';

function normalizeInput(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(/\r\n?/g, '\n');
}

function replaceCodeBlocks(text) {
  return text.replace(/```[\s\S]*?```/g, ` ${CODE_BLOCK_PLACEHOLDER} `);
}

function replaceInlineCode(text) {
  return text.replace(/`[^`\n]+`/g, ` ${INLINE_CODE_PLACEHOLDER} `);
}

function stripMarkdownLinks(text) {
  let output = text;
  output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, altText) => {
    return altText && altText.trim() ? ` ${altText.trim()} ` : ' 图片 ';
  });
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label) => {
    return label && label.trim() ? ` ${label.trim()} ` : ' ';
  });
  return output;
}

function stripUrls(text) {
  return text
    .replace(/<https?:\/\/[^>\s]+>/gi, ' ')
    .replace(/\b(?:https?:\/\/|www\.)[^\s<>()]+/gi, ' ');
}

function stripMarkdownControls(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-+*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~#|]/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function keepReadableCharacters(text) {
  return text.replace(/[^\p{L}\p{N}\s\u4e00-\u9fff,.!?;:()'"“”‘’\-，。！？；：（）]/gu, ' ');
}

function collapseNoise(text) {
  return text
    .replace(/([，。！？,.!?])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeTtsText(rawText, maxLength = 500) {
  const lengthLimit = Number.isFinite(maxLength) && maxLength > 0
    ? Math.floor(maxLength)
    : 500;

  let output = normalizeInput(rawText);
  output = replaceCodeBlocks(output);
  output = replaceInlineCode(output);
  output = stripMarkdownLinks(output);
  output = stripUrls(output);
  output = stripMarkdownControls(output);
  output = keepReadableCharacters(output);
  output = collapseNoise(output);

  if (output.length > lengthLimit) {
    output = output.slice(0, lengthLimit).trim();
  }

  return output;
}

module.exports = {
  sanitizeTtsText,
  CODE_BLOCK_PLACEHOLDER,
  INLINE_CODE_PLACEHOLDER,
};
