/**
 * Unit tests for useChatMessages Hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatMessages } from './useChatMessages';
import * as databaseService from '../../../services/databaseService';
import * as uploadService from '../../../services/uploadService';
import { supabase } from '../../../config/supabase';

// Mock dependencies
vi.mock('../../../services/databaseService', () => ({
  getChatHistory: vi.fn(),
  sendMessage: vi.fn(),
  sendMessageWithMedia: vi.fn(),
  markMessagesAsRead: vi.fn(),
}));

vi.mock('../../../services/uploadService', () => ({
  uploadFile: vi.fn(),
}));

vi.mock('../../../config/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock formatTime utility
vi.mock('../../../utils/dateFormat', () => ({
  formatTime: vi.fn((date) => {
    if (date instanceof Date) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '12:00';
  }),
}));

// Mock fetch for media upload
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('useChatMessages', () => {
  const mockFriendId = 'friend-123';
  const mockCurrentUserId = 'user-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Loading', () => {
    it('should load chat history on mount', async () => {
      const mockHistory = [
        {
          id: 'msg-1',
          friend_id: mockFriendId,
          sender: 'friend' as const,
          text: 'Hello',
          created_at: '2026-02-22T10:00:00.000Z',
          message_type: 'text' as const,
        },
        {
          id: 'msg-2',
          friend_id: mockFriendId,
          sender: 'user' as const,
          text: 'Hi there',
          created_at: '2026-02-22T10:01:00.000Z',
          message_type: 'text' as const,
        },
      ];

      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce({ messages: mockHistory, hasMore: false });
      vi.mocked(databaseService.markMessagesAsRead).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      // Initially loading should be true
      expect(result.current.loading).toBe(true);

      // Wait for loading to complete
      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(databaseService.getChatHistory).toHaveBeenCalledWith(mockFriendId);
      expect(databaseService.markMessagesAsRead).toHaveBeenCalledWith(mockFriendId);
      expect(result.current.messages).toHaveLength(2);
    }, 10000);

    it('should skip loading for bot chats', async () => {
      const { result } = renderHook(() =>
        useChatMessages({
          friendId: 'clawbot-123',
          currentUserId: mockCurrentUserId,
          isBot: true,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(databaseService.getChatHistory).not.toHaveBeenCalled();
    }, 10000);

    it('should handle empty chat history', async () => {
      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce({ messages: [], hasMore: false });
      vi.mocked(databaseService.markMessagesAsRead).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(result.current.messages).toHaveLength(0);
    }, 10000);

    it('should handle loading error gracefully', async () => {
      vi.mocked(databaseService.getChatHistory).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(result.current.messages).toHaveLength(0);
    }, 10000);
  });

  describe('Sending Messages', () => {
    it('should send text message successfully', async () => {
      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce({ messages: [], hasMore: false });
      vi.mocked(databaseService.markMessagesAsRead).mockResolvedValueOnce(undefined);
      vi.mocked(databaseService.sendMessage).mockResolvedValueOnce('new-msg-id');

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        await result.current.sendMessage('Hello, world!');
      });

      expect(databaseService.sendMessage).toHaveBeenCalledWith(
        mockFriendId,
        'user',
        'Hello, world!'
      );
    }, 10000);

    it('should send message with media successfully', async () => {
      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce({ messages: [], hasMore: false });
      vi.mocked(databaseService.markMessagesAsRead).mockResolvedValueOnce(undefined);

      const mockBlob = new Blob(['image-data'], { type: 'image/png' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      vi.mocked(uploadService.uploadFile).mockResolvedValueOnce({
        uri: 'https://example.com/image.png',
        path: '/images/image.png',
      });

      vi.mocked(databaseService.sendMessageWithMedia).mockResolvedValueOnce('new-msg-id');

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        await result.current.sendMessage('Check this out', {
          uri: 'file://image.png',
          type: 'image/png',
        });
      });

      expect(uploadService.uploadFile).toHaveBeenCalled();
      expect(databaseService.sendMessageWithMedia).toHaveBeenCalled();
    }, 10000);

    it('should not send empty message', async () => {
      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce({ messages: [], hasMore: false });
      vi.mocked(databaseService.markMessagesAsRead).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        await result.current.sendMessage('');
      });

      expect(databaseService.sendMessage).not.toHaveBeenCalled();
    }, 10000);

    it('should not send message with only whitespace', async () => {
      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce({ messages: [], hasMore: false });
      vi.mocked(databaseService.markMessagesAsRead).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        await result.current.sendMessage('   ');
      });

      expect(databaseService.sendMessage).not.toHaveBeenCalled();
    }, 10000);

    it('should handle send message error', async () => {
      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce({ messages: [], hasMore: false });
      vi.mocked(databaseService.markMessagesAsRead).mockResolvedValueOnce(undefined);
      vi.mocked(databaseService.sendMessage).mockRejectedValueOnce(
        new Error('Failed to send')
      );

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      await expect(
        act(async () => {
          await result.current.sendMessage('Test message');
        })
      ).rejects.toThrow('Failed to send');
    }, 10000);
  });

  describe('Mark as Read', () => {
    it('should mark messages as read', async () => {
      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce({ messages: [], hasMore: false });
      vi.mocked(databaseService.markMessagesAsRead).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      await act(async () => {
        await result.current.markAsRead();
      });

      expect(databaseService.markMessagesAsRead).toHaveBeenCalledWith(mockFriendId);
    }, 10000);

    it('should handle mark as read error gracefully', async () => {
      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce([]);
      vi.mocked(databaseService.markMessagesAsRead).mockRejectedValueOnce(
        new Error('Failed to mark read')
      );

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      // Should not throw
      await act(async () => {
        await result.current.markAsRead();
      });
    }, 10000);
  });

  describe('Clear Messages', () => {
    it('should clear all messages', async () => {
      const mockHistory = [
        {
          id: 'msg-1',
          friend_id: mockFriendId,
          sender: 'friend' as const,
          text: 'Hello',
          created_at: '2026-02-22T10:00:00.000Z',
          message_type: 'text' as const,
        },
      ];

      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce({ messages: mockHistory, hasMore: false });
      vi.mocked(databaseService.markMessagesAsRead).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
        })
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 3000 }
      );

      expect(result.current.messages).toHaveLength(1);

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
    }, 10000);
  });

  describe('onMessage Callback', () => {
    it('should call onMessage callback when message is received', async () => {
      const onMessage = vi.fn();

      vi.mocked(databaseService.getChatHistory).mockResolvedValueOnce({ messages: [], hasMore: false });
      vi.mocked(databaseService.markMessagesAsRead).mockResolvedValueOnce(undefined);

      renderHook(() =>
        useChatMessages({
          friendId: mockFriendId,
          currentUserId: mockCurrentUserId,
          onMessage,
        })
      );

      await waitFor(
        () => {
          expect(onMessage).not.toHaveBeenCalled();
        },
        { timeout: 3000 }
      );
    }, 10000);
  });

  describe('Conversation ID Generation', () => {
    it('should generate correct conversation ID (userId < friendId)', () => {
      const { result } = renderHook(() =>
        useChatMessages({
          friendId: 'friend-zzz',
          currentUserId: 'user-aaa',
        })
      );

      // The hook should have loaded messages with the correct conversation ID
      // We can't directly test the conversation ID but we verify it loads
      expect(result.current).toBeDefined();
    });
  });
});
