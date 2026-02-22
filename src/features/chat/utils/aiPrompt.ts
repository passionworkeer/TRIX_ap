export type AIActionId = 'chat' | 'doc' | 'slide' | 'table' | 'image' | 'video';

export const AI_ACTION_PREFIXES: Record<AIActionId, string> = {
  chat: '',
  doc: '@AI_DOC 请帮我创建文档：',
  slide: '@AI_SLIDE 请帮我创建幻灯片：',
  table: '@AI_TABLE 请帮我创建表格：',
  image: '@AI_IMAGE 请帮我生成图片：',
  video: '@AI_VIDEO 请帮我生成视频：',
};

const prefixEntries = Object.entries(AI_ACTION_PREFIXES) as Array<[AIActionId, string]>;

function removeLeadingKnownPrefix(text: string) {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const firstLine = lines[0] ?? '';

  for (const [actionId, prefix] of prefixEntries) {
    if (!prefix || !firstLine.startsWith(prefix)) continue;

    const firstLineRemainder = firstLine.slice(prefix.length).trimStart();
    const bodyLines: string[] = [];

    if (firstLineRemainder) {
      bodyLines.push(firstLineRemainder);
    }
    bodyLines.push(...lines.slice(1));

    return {
      actionId,
      body: bodyLines.join('\n').replace(/^\n+/, '').trimStart(),
    };
  }

  return {
    actionId: 'chat' as AIActionId,
    body: normalized,
  };
}

export function detectAIActionFromInput(text: string): AIActionId {
  return removeLeadingKnownPrefix(text).actionId;
}

export function applyAIActionPrefix(text: string, actionId: AIActionId): string {
  const { body } = removeLeadingKnownPrefix(text);
  const prefix = AI_ACTION_PREFIXES[actionId];

  if (!prefix) {
    return body;
  }
  if (!body.trim()) {
    return prefix;
  }

  return `${prefix}\n${body}`;
}
