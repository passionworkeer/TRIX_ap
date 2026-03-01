/**
 *ClawbotMessages Unit tests for use Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useClawbotMessages } from './useClawbotMessages';
import type { ClawbotChannelMessage } from '../services/ClawbotChannelBridge';

describe('useClawbotMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty messages initially', () => {
      const { result } = renderHook(() => useClawbotMessages());

      expect(result.current.messages).toEqual([]);
    });

    it('should return all required functions', () => {
      const { result } = renderHook(() => useClawbotMessages());

      expect(result.current.upsertMessage).toBeDefined();
      expect(result.current.addMessages).toBeDefined();
      expect(result.current.removeMessage).toBeDefined();
      expect(result.current.clearMessages).toBeDefined();
      expect(result.current.loadHistoryMessages).toBeDefined();
      expect(result.current.persistMessage).toBeDefined();
    });
  });

  describe('upsertMessage', () => {
    it('should add new message', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.upsertMessage(message);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual(message);
    });

    it('should not add duplicate message', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.upsertMessage(message);
        result.current.upsertMessage(message);
      });

      expect(result.current.messages).toHaveLength(1);
    });

    it('should generate message ID if not provided', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const message: ClawbotChannelMessage = {
        sender: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.upsertMessage(message);
      });

      expect(result.current.messages[0].id).toBeDefined();
      expect(result.current.messages[0].id).toContain('user-');
    });

    it('should sort messages by timestamp', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const message1: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'user',
        content: 'Second',
        timestamp: 2000,
      };

      const message2: ClawbotChannelMessage = {
        id: 'msg-2',
        sender: 'user',
        content: 'First',
        timestamp: 1000,
      };

      act(() => {
        result.current.upsertMessage(message1);
        result.current.upsertMessage(message2);
      });

      expect(result.current.messages[0].content).toBe('First');
      expect(result.current.messages[1].content).toBe('Second');
    });
  });

  describe('addMessages', () => {
    it('should add multiple messages', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const messages: ClawbotChannelMessage[] = [
        { id: 'msg-1', sender: 'user', content: 'Hello', timestamp: 1000 },
        { id: 'msg-2', sender: 'bot', content: 'Hi there', timestamp: 2000 },
      ];

      act(() => {
        result.current.addMessages(messages);
      });

      expect(result.current.messages).toHaveLength(2);
    });

    it('should filter out duplicate messages', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const messages1: ClawbotChannelMessage[] = [
        { id: 'msg-1', sender: 'user', content: 'Hello', timestamp: 1000 },
      ];

      const messages2: ClawbotChannelMessage[] = [
        { id: 'msg-1', sender: 'user', content: 'Hello', timestamp: 1000 },
        { id: 'msg-2', sender: 'bot', content: 'Hi', timestamp: 2000 },
      ];

      act(() => {
        result.current.addMessages(messages1);
        result.current.addMessages(messages2);
      });

      expect(result.current.messages).toHaveLength(2);
    });

    it('should return previous state when no new unique messages', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const messages1: ClawbotChannelMessage[] = [
        { id: 'msg-1', sender: 'user', content: 'Hello', timestamp: 1000 },
      ];

      const messages2: ClawbotChannelMessage[] = [
        { id: 'msg-1', sender: 'user', content: 'Hello', timestamp: 1000 },
      ];

      act(() => {
        result.current.addMessages(messages1);
      });

      const firstState = result.current.messages;

      act(() => {
        result.current.addMessages(messages2);
      });

      expect(result.current.messages).toBe(firstState);
    });

    it('should sort messages after batch add', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const messages: ClawbotChannelMessage[] = [
        { id: 'msg-3', sender: 'user', content: 'Third', timestamp: 3000 },
        { id: 'msg-1', sender: 'user', content: 'First', timestamp: 1000 },
        { id: 'msg-2', sender: 'user', content: 'Second', timestamp: 2000 },
      ];

      act(() => {
        result.current.addMessages(messages);
      });

      expect(result.current.messages[0].content).toBe('First');
      expect(result.current.messages[1].content).toBe('Second');
      expect(result.current.messages[2].content).toBe('Third');
    });
  });

  describe('removeMessage', () => {
    it('should remove message by ID', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const messages: ClawbotChannelMessage[] = [
        { id: 'msg-1', sender: 'user', content: 'Hello', timestamp: 1000 },
        { id: 'msg-2', sender: 'bot', content: 'Hi there', timestamp: 2000 },
      ];

      act(() => {
        result.current.addMessages(messages);
      });

      act(() => {
        result.current.removeMessage('msg-1');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].id).toBe('msg-2');
    });

    it('should handle removing non-existent message', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'user',
        content: 'Hello',
        timestamp: 1000,
      };

      act(() => {
        result.current.upsertMessage(message);
      });

      act(() => {
        result.current.removeMessage('non-existent');
      });

      expect(result.current.messages).toHaveLength(1);
    });
  });

  describe('clearMessages', () => {
    it('should clear all messages', () => {
      const { result } = renderHook(() => useClawbotMessages());

      const messages: ClawbotChannelMessage[] = [
        { id: 'msg-1', sender: 'user', content: 'Hello', timestamp: 1000 },
        { id: 'msg-2', sender: 'bot', content: 'Hi there', timestamp: 2000 },
      ];

      act(() => {
        result.current.addMessages(messages);
      });

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('loadHistoryMessages', () => {
    it('should load history when userId and loadHistory provided', async () => {
      const mockLoadHistory = vi.fn().mockResolvedValue([
        { id: 'hist-1', sender: 'user', content: 'History 1', timestamp: 1000 },
        { id: 'hist-2', sender: 'bot', content: 'History 2', timestamp: 2000 },
      ]);

      const { result } = renderHook(() =>
        useClawbotMessages({
          userId: 'user-123',
          loadHistory: mockLoadHistory,
        })
      );

      await act(async () => {
        await result.current.loadHistoryMessages();
      });

      expect(mockLoadHistory).toHaveBeenCalledWith('user-123');
      expect(result.current.messages).toHaveLength(2);
    });

    it('should not load history without userId', async () => {
      const mockLoadHistory = vi.fn();

      const { result } = renderHook(() =>
        useClawbotMessages({
          loadHistory: mockLoadHistory,
        })
      );

      await act(async () => {
        await result.current.loadHistoryMessages();
      });

      expect(mockLoadHistory).not.toHaveBeenCalled();
    });

    it('should not load history without loadHistory function', async () => {
      const { result } = renderHook(() =>
        useClawbotMessages({
          userId: 'user-123',
        })
      );

      await act(async () => {
        await result.current.loadHistoryMessages();
      });

      // Should not throw
      expect(result.current.messages).toEqual([]);
    });

    it('should filter duplicate history messages', async () => {
      const existingMessage: ClawbotChannelMessage = {
        id: 'hist-1',
        sender: 'user',
        content: 'Existing',
        timestamp: 1000,
      };

      const mockLoadHistory = vi.fn().mockResolvedValue([
        existingMessage,
        { id: 'hist-2', sender: 'bot', content: 'New', timestamp: 2000 },
      ]);

      const { result } = renderHook(() =>
        useClawbotMessages({
          userId: 'user-123',
          loadHistory: mockLoadHistory,
        })
      );

      // First add the existing message
      act(() => {
        result.current.upsertMessage(existingMessage);
      });

      // Then load history
      await act(async () => {
        await result.current.loadHistoryMessages();
      });

      expect(result.current.messages).toHaveLength(2);
    });
  });

  describe('persistMessage', () => {
    it('should save message when userId and saveMessage provided', async () => {
      const mockSaveMessage = vi.fn().mockResolvedValue(undefined);

      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      };

      const { result } = renderHook(() =>
        useClawbotMessages({
          userId: 'user-123',
          saveMessage: mockSaveMessage,
        })
      );

      await act(async () => {
        await result.current.persistMessage(message);
      });

      expect(mockSaveMessage).toHaveBeenCalledWith('user-123', expect.objectContaining({
        content: 'Hello',
      }));
    });

    it('should not persist without userId', async () => {
      const mockSaveMessage = vi.fn();

      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      };

      const { result } = renderHook(() =>
        useClawbotMessages({
          saveMessage: mockSaveMessage,
        })
      );

      await act(async () => {
        await result.current.persistMessage(message);
      });

      expect(mockSaveMessage).not.toHaveBeenCalled();
    });

    it('should not persist without saveMessage function', async () => {
      const message: ClawbotChannelMessage = {
        id: 'msg-1',
        sender: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      };

      const { result } = renderHook(() =>
        useClawbotMessages({
          userId: 'user-123',
        })
      );

      // Should not throw
      await act(async () => {
        await result.current.persistMessage(message);
      });
    });

    it('should generate ID if not provided', async () => {
      const mockSaveMessage = vi.fn().mockResolvedValue(undefined);

      const message: ClawbotChannelMessage = {
        sender: 'user',
        content: 'Hello',
        timestamp: 1000,
      };

      const { result } = renderHook(() =>
        useClawbotMessages({
          userId: 'user-123',
          saveMessage: mockSaveMessage,
        })
      );

      await act(async () => {
        await result.current.persistMessage(message);
      });

      expect(mockSaveMessage).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          id: expect.stringContaining('user-'),
        })
      );
    });
  });
});
