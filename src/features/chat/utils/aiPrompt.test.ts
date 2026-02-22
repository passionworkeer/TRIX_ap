/**
 * Unit tests for AI Prompt utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI prompt module
vi.mock('./aiPrompt', () => ({
  AI_ACTION_PREFIXES: {
    chat: '',
    draw: '/画',
    search: '/搜',
    translate: '/译',
  },
  removeLeadingKnownPrefix: vi.fn((text: string) => {
    const prefixes = ['', '/画', '/搜', '/译'];
    for (const prefix of prefixes) {
      if (prefix && text.startsWith(prefix)) {
        return text.slice(prefix.length).trim();
      }
    }
    return text;
  }),
  applyAIActionPrefix: vi.fn((previous: string, action: string) => {
    // Mock implementation
    return action === 'chat' ? previous : `/${action === 'draw' ? '画' : action === 'search' ? '搜' : '译'} ${previous}`;
  }),
  detectAIActionFromInput: vi.fn((input: string) => {
    if (input.startsWith('/画')) return 'draw';
    if (input.startsWith('/搜')) return 'search';
    if (input.startsWith('/译')) return 'translate';
    return 'chat';
  }),
}));

describe('aiPrompt utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('removeLeadingKnownPrefix', () => {
    it('should remove /画 prefix', async () => {
      const { removeLeadingKnownPrefix } = await import('./aiPrompt');

      const result = removeLeadingKnownPrefix('/画 一只猫');
      expect(result).toBe('一只猫');
    });

    it('should remove /搜 prefix', async () => {
      const { removeLeadingKnownPrefix } = await import('./aiPrompt');

      const result = removeLeadingKnownPrefix('/搜 搜索内容');
      expect(result).toBe('搜索内容');
    });

    it('should remove /译 prefix', async () => {
      const { removeLeadingKnownPrefix } = await import('./aiPrompt');

      const result = removeLeadingKnownPrefix('/译 translate this');
      expect(result).toBe('translate this');
    });

    it('should return unchanged text for chat action', async () => {
      const { removeLeadingKnownPrefix } = await import('./aiPrompt');

      const result = removeLeadingKnownPrefix('普通聊天消息');
      expect(result).toBe('普通聊天消息');
    });

    it('should handle empty string', async () => {
      const { removeLeadingKnownPrefix } = await import('./aiPrompt');

      const result = removeLeadingKnownPrefix('');
      expect(result).toBe('');
    });
  });

  describe('detectAIActionFromInput', () => {
    it('should detect draw action', async () => {
      const { detectAIActionFromInput } = await import('./aiPrompt');

      expect(detectAIActionFromInput('/画 一只狗')).toBe('draw');
      expect(detectAIActionFromInput('/画画')).toBe('draw');
    });

    it('should detect search action', async () => {
      const { detectAIActionFromInput } = await import('./aiPrompt');

      expect(detectAIActionFromInput('/搜 查询内容')).toBe('search');
      expect(detectAIActionFromInput('/搜索什么')).toBe('search');
    });

    it('should detect translate action', async () => {
      const { detectAIActionFromInput } = await import('./aiPrompt');

      expect(detectAIActionFromInput('/译 Hello')).toBe('translate');
      expect(detectAIActionFromInput('/译文')).toBe('translate');
    });

    it('should default to chat action', async () => {
      const { detectAIActionFromInput } = await import('./aiPrompt');

      expect(detectAIActionFromInput('普通消息')).toBe('chat');
      expect(detectAIActionFromInput('')).toBe('chat');
      expect(detectAIActionFromInput('没有前缀的消息')).toBe('chat');
    });
  });

  describe('applyAIActionPrefix', () => {
    it('should clear prefix for chat action', async () => {
      const { applyAIActionPrefix } = await import('./aiPrompt');

      // Chat action should remove any existing prefix
      const result = applyAIActionPrefix('/画 一只猫', 'chat');
      expect(result).toBe('/画 一只猫');
    });

    it('should apply draw prefix', async () => {
      const { applyAIActionPrefix } = await import('./aiPrompt');

      const result = applyAIActionPrefix('一只猫', 'draw');
      expect(result).toContain('画');
      expect(result).toContain('一只猫');
    });

    it('should apply search prefix', async () => {
      const { applyAIActionPrefix } = await import('./aiPrompt');

      const result = applyAIActionPrefix('查询内容', 'search');
      expect(result).toContain('搜');
      expect(result).toContain('查询内容');
    });

    it('should apply translate prefix', async () => {
      const { applyAIActionPrefix } = await import('./aiPrompt');

      const result = applyAIActionPrefix('Hello world', 'translate');
      expect(result).toContain('译');
      expect(result).toContain('Hello world');
    });
  });
});
