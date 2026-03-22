/**
 * Unit tests for chatService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'msg-id-123' }, error: null })
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      })),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null })
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn()
    })),
    removeChannel: vi.fn()
  }
}));

// Mock errorHandler
vi.mock('../utils/errorHandler', () => ({
  handleGlobalError: vi.fn()
}));

// Import after mocks
import { supabase } from '../config/supabase';
import { handleGlobalError } from '../utils/errorHandler';
import {
  getChatHistory,
  sendMessage,
  sendMessageWithMedia,
  markMessagesAsRead,
  clearChatHistory,
  getUnreadCounts,
  getTotalUnreadCount,
  subscribeToChatMessages,
  subscribeToUnreadCounts
} from './chatService';

describe('chatService', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // getChatHistory Tests
  // ============================================

  describe('getChatHistory', () => {
    it('should return empty array when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getChatHistory('friend-456');
      expect(result).toEqual({ messages: [], hasMore: false });
    });

    it('should return empty array when no messages', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })
            })
          })
        })
      } as any);

      const result = await getChatHistory('friend-456');
      expect(result).toEqual({ messages: [], hasMore: false });
    });

    it('should return messages correctly transformed', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      const mockMessages = [
        {
          id: 'msg-1',
          conversation_id: 'user-123_friend-456',
          sender_id: 'user-123',
          receiver_id: 'friend-456',
          text: 'Hello',
          is_read: false,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'msg-2',
          conversation_id: 'user-123_friend-456',
          sender_id: 'friend-456',
          receiver_id: 'user-123',
          text: 'Hi there',
          is_read: false,
          created_at: '2024-01-01T01:00:00Z'
        }
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: mockMessages, error: null, count: 2 })
            })
          })
        })
      } as any);

      const result = await getChatHistory('friend-456');

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].sender).toBe('user');
      expect(result.messages[0].text).toBe('Hello');
      expect(result.messages[1].sender).toBe('friend');
      expect(result.messages[1].text).toBe('Hi there');
    });

    it('should return empty array on error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') })
            })
          })
        })
      } as any);

      const result = await getChatHistory('friend-456');
      expect(result).toEqual({ messages: [], hasMore: false });
      expect(handleGlobalError).toHaveBeenCalled();
    });
  });

  // ============================================
  // sendMessage Tests
  // ============================================

  describe('sendMessage', () => {
    it('should return null when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await sendMessage('friend-456', 'user', 'Hello');
      expect(result).toBeNull();
    });

    it('should return message id on success', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'msg-id-123' }, error: null })
          })
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any);

      const result = await sendMessage('friend-456', 'user', 'Hello');

      expect(result).toBe('msg-id-123');
    });

    it('should return null on insert error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Insert failed') })
          })
        })
      } as any);

      const result = await sendMessage('friend-456', 'user', 'Hello');

      expect(result).toBeNull();
      expect(handleGlobalError).toHaveBeenCalled();
    });
  });

  // ============================================
  // sendMessageWithMedia Tests
  // ============================================

  describe('sendMessageWithMedia', () => {
    it('should return null when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const mediaData = {
        uri: 'file:///test.jpg',
        type: 'image/jpeg',
        size: 1024,
        category: 'image' as const
      };

      const result = await sendMessageWithMedia('friend-456', 'user', 'Test', mediaData, 'image');
      expect(result).toBeNull();
    });

    it('should return message id on success with media', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'msg-id-456' }, error: null })
          })
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any);

      const mediaData = {
        uri: 'file:///test.jpg',
        type: 'image/jpeg',
        size: 1024,
        category: 'image' as const,
        metadata: { width: 800, height: 600 }
      };

      const result = await sendMessageWithMedia('friend-456', 'user', 'Check this out', mediaData, 'image');

      expect(result).toBe('msg-id-456');
    });

    it('should handle empty text for media-only messages', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'msg-id-789' }, error: null })
          })
        }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any);

      const mediaData = {
        uri: 'file:///video.mp4',
        type: 'video/mp4',
        size: 5000,
        category: 'video' as const,
        metadata: { duration: 30 }
      };

      const result = await sendMessageWithMedia('friend-456', 'user', '', mediaData, 'video');

      expect(result).toBe('msg-id-789');
    });
  });

  // ============================================
  // markMessagesAsRead Tests
  // ============================================

  describe('markMessagesAsRead', () => {
    it('should return undefined when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await markMessagesAsRead('friend-456');
      expect(result).toBeUndefined();
    });

    it('should call rpc to mark messages as read', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null });

      await markMessagesAsRead('friend-456');

      expect(supabase.rpc).toHaveBeenCalledWith('mark_messages_as_read', {
        p_user_id: 'user-123',
        p_friend_id: 'friend-456'
      });
    });

    it('should handle rpc error gracefully', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error('RPC error') });

      // Should not throw
      await expect(markMessagesAsRead('friend-456')).resolves.not.toThrow();
    });
  });

  // ============================================
  // clearChatHistory Tests
  // ============================================

  describe('clearChatHistory', () => {
    it('should return undefined when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await clearChatHistory('friend-456');
      expect(result).toBeUndefined();
    });

    it('should delete all messages in conversation', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      const mockDelete = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete
      } as any);

      await clearChatHistory('friend-456');

      expect(mockDelete).toHaveBeenCalled();
    });
  });

  // ============================================
  // getUnreadCounts Tests
  // ============================================

  describe('getUnreadCounts', () => {
    it('should return empty array when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getUnreadCounts();
      expect(result).toEqual([]);
    });

    it('should return empty array when no unread counts', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      } as any);

      const result = await getUnreadCounts();

      expect(result).toEqual([]);
    });

    it('should return unread counts correctly', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      const mockUnreadCounts = [
        { id: '1', user_id: 'user-123', friend_id: 'friend-1', unread_count: 5, last_message: 'Hi', last_message_time: '2024-01-01T00:00:00Z' },
        { id: '2', user_id: 'user-123', friend_id: 'friend-2', unread_count: 3, last_message: 'Hello', last_message_time: '2024-01-02T00:00:00Z' }
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: mockUnreadCounts, error: null })
        })
      } as any);

      const result = await getUnreadCounts();

      expect(result).toHaveLength(2);
      expect(result[0].unread_count).toBe(5);
      expect(result[1].unread_count).toBe(3);
    });

    it('should return empty array on error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') })
        })
      } as any);

      const result = await getUnreadCounts();

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // getTotalUnreadCount Tests
  // ============================================

  describe('getTotalUnreadCount', () => {
    it('should return 0 when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getTotalUnreadCount();
      expect(result).toBe(0);
    });

    it('should return 0 when no unread counts', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      } as any);

      const result = await getTotalUnreadCount();

      expect(result).toBe(0);
    });

    it('should return total unread count correctly', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              { unread_count: 5 },
              { unread_count: 3 },
              { unread_count: 2 }
            ],
            error: null
          })
        })
      } as any);

      const result = await getTotalUnreadCount();

      expect(result).toBe(10);
    });

    it('should return 0 on error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') })
        })
      } as any);

      const result = await getTotalUnreadCount();

      expect(result).toBe(0);
    });
  });

  // ============================================
  // subscribeToChatMessages Tests
  // ============================================

  describe('subscribeToChatMessages', () => {
    it('should return empty function when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const callback = vi.fn();

      const unsubscribe = await subscribeToChatMessages('friend-456', callback);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should return unsubscribe function', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as any);

      const callback = vi.fn();
      const unsubscribe = await subscribeToChatMessages('friend-456', callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalled();
    });
  });

  // ============================================
  // subscribeToUnreadCounts Tests
  // ============================================

  describe('subscribeToUnreadCounts', () => {
    it('should return empty function when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const callback = vi.fn();

      const unsubscribe = await subscribeToUnreadCounts(callback);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should return unsubscribe function', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as any);

      const callback = vi.fn();
      const unsubscribe = await subscribeToUnreadCounts(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalled();
    });
  });
});
