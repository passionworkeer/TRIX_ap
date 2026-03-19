export type TrixResolvedTarget =
  | { kind: 'conversation'; conversationId: string }
  | { kind: 'peer'; peerId: string };

export function normalizeTrixTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^trix-native:/i.test(trimmed)) {
    return trimmed.replace(/^trix-native:/i, '').trim();
  }
  if (/^conv_/i.test(trimmed)) {
    return `conv:${trimmed}`;
  }
  return trimmed;
}

export function looksLikeTrixTarget(raw: string): boolean {
  const normalized = normalizeTrixTarget(raw);
  if (!normalized) {
    return false;
  }
  return /^conv:/i.test(normalized) || /^user:/i.test(normalized) || /^conv_/i.test(normalized);
}

export function parseTrixTarget(raw: string): TrixResolvedTarget | null {
  const normalized = normalizeTrixTarget(raw);
  if (!normalized) {
    return null;
  }
  if (/^conv:/i.test(normalized)) {
    return { kind: 'conversation', conversationId: normalized.slice(5) };
  }
  if (/^user:/i.test(normalized)) {
    return { kind: 'peer', peerId: normalized.slice(5) };
  }
  if (/^conv_/i.test(normalized)) {
    return { kind: 'conversation', conversationId: normalized };
  }
  return null;
}

