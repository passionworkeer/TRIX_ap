/**
 * Unit tests for databaseService
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', mockLocalStorage);

// Mock console.error to avoid noise in tests
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Create mock Supabase client
const createMockSupabase = () => {
  const mockFromFn = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        like: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      or: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      upsert: vi.fn(() => ({
        onConflict: vi.fn(() => ({
          ignoreDuplicates: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })),
  }));

  return {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
    from: mockFromFn,
    rpc: vi.fn(() => Promise.resolve({ error: null })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(() => ({ status: 'SUBSCRIBED' })),
      })),
      subscribe: vi.fn(() => ({ status: 'SUBSCRIBED' })),
      removeChannel: vi.fn(),
    })),
    removeChannel: vi.fn(),
  };
};

const mockSupabase = createMockSupabase();

// Mock Supabase module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Mock the supabase config to use our mock
vi.mock('../config/supabase', () => ({
  supabase: mockSupabase,
  getCurrentUserId: vi.fn(() => Promise.resolve('current-user-id')),
}));

// Mock errorHandler
vi.mock('../utils/errorHandler', () => ({
  handleGlobalError: vi.fn(),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    DEV: true,
    PROD: false,
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  },
});

describe('databaseService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReset();
    mockLocalStorage.setItem.mockReset();
    mockLocalStorage.removeItem.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
    mockConsoleError.mockClear();
  });

  // ============================================
  // Clawbot History Message Tests (localStorage)
  // ============================================

  describe('loadClawbotMessageHistory', () => {
    it('should return empty array for empty userId', async () => {
      const { loadClawbotMessageHistory } = await import('../services/databaseService');
      const result = await loadClawbotMessageHistory('');
      expect(result).toEqual([]);
    });

    it('should return empty array when no data in localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const { loadClawbotMessageHistory } = await import('../services/databaseService');
      const result = await loadClawbotMessageHistory('user-123');
      expect(result).toEqual([]);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('trix_clawbot_history:user-123');
    });

    it('should return empty array when data is not valid JSON', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      const { loadClawbotMessageHistory } = await import('../services/databaseService');
      const result = await loadClawbotMessageHistory('user-123');
      expect(result).toEqual([]);
    });

    it('should return empty array when data is not an array', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ key: 'value' }));

      const { loadClawbotMessageHistory } = await import('../services/databaseService');
      const result = await loadClawbotMessageHistory('user-123');
      expect(result).toEqual([]);
    });

    it('should return normalized messages for valid data', async () => {
      const validMessages = [
        { id: 'msg-1', content: 'Hello', contentType: 'text', sender: 'user', timestamp: 1700000000000 },
        { id: 'msg-2', content: 'Hi there', contentType: 'text', sender: 'bot', timestamp: 1700000001000 },
      ];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(validMessages));

      const { loadClawbotMessageHistory } = await import('../services/databaseService');
      const result = await loadClawbotMessageHistory('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
    });

    it('should filter out invalid messages', async () => {
      const mixedMessages = [
        { id: 'msg-1', content: 'Hello', contentType: 'text', sender: 'user', timestamp: 1700000000000 },
        { id: '', content: 'Invalid', contentType: 'text', sender: 'user', timestamp: 1700000001000 },
        { content: 'Missing id', contentType: 'text', sender: 'user', timestamp: 1700000002000 },
      ];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mixedMessages));

      const { loadClawbotMessageHistory } = await import('../services/databaseService');
      const result = await loadClawbotMessageHistory('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-1');
    });

    it('should sort messages by timestamp ascending', async () => {
      const messages = [
        { id: 'msg-2', content: 'Second', contentType: 'text', sender: 'user', timestamp: 1700000002000 },
        { id: 'msg-1', content: 'First', contentType: 'text', sender: 'user', timestamp: 1700000001000 },
        { id: 'msg-3', content: 'Third', contentType: 'text', sender: 'user', timestamp: 1700000003000 },
      ];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(messages));

      const { loadClawbotMessageHistory } = await import('../services/databaseService');
      const result = await loadClawbotMessageHistory('user-123');

      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
      expect(result[2].id).toBe('msg-3');
    });
  });

  describe('saveClawbotMessage', () => {
    it('should return early for empty userId', async () => {
      const { saveClawbotMessage } = await import('../services/databaseService');
      const message = { id: 'msg-1', content: 'Hello', contentType: 'text' as const, sender: 'user' as const, timestamp: 1700000000000 };

      await saveClawbotMessage('', message);

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should return early for invalid message', async () => {
      const { saveClawbotMessage } = await import('../services/databaseService');
      const invalidMessage = { id: '', content: '', contentType: 'text' as const, sender: 'user' as const, timestamp: 0 };

      await saveClawbotMessage('user-123', invalidMessage);

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should save message to localStorage', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      const message = { id: 'msg-1', content: 'Hello', contentType: 'text' as const, sender: 'user' as const, timestamp: 1700000000000 };

      const { saveClawbotMessage } = await import('../services/databaseService');
      await saveClawbotMessage('user-123', message);

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const [, value] = mockLocalStorage.setItem.mock.calls[0];
      const saved = JSON.parse(value);
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('msg-1');
    });

    it('should replace existing message with same id', async () => {
      const existing = [
        { id: 'msg-1', content: 'Old', contentType: 'text', sender: 'user', timestamp: 1700000000000 },
        { id: 'msg-2', content: 'Second', contentType: 'text', sender: 'user', timestamp: 1700000001000 },
      ];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existing));

      const { saveClawbotMessage } = await import('../services/databaseService');
      await saveClawbotMessage('user-123', { id: 'msg-1', content: 'Updated', contentType: 'text' as const, sender: 'user' as const, timestamp: 1700000000000 });

      const [, value] = mockLocalStorage.setItem.mock.calls[0];
      const saved = JSON.parse(value);
      expect(saved).toHaveLength(2);
      expect(saved.find((m: any) => m.id === 'msg-1')?.content).toBe('Updated');
    });

    it('should limit messages to MAX_MESSAGES (500)', async () => {
      const manyMessages = Array.from({ length: 550 }, (_, i) => ({
        id: `msg-${i}`,
        content: `Message ${i}`,
        contentType: 'text' as const,
        sender: 'user' as const,
        timestamp: 1700000000000 + i * 1000,
      }));
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(manyMessages));

      const message = { id: 'new-msg', content: 'New', contentType: 'text' as const, sender: 'user' as const, timestamp: 1800000000000 };
      const { saveClawbotMessage } = await import('../services/databaseService');
      await saveClawbotMessage('user-123', message);

      const [, value] = mockLocalStorage.setItem.mock.calls[0];
      const saved = JSON.parse(value);
      expect(saved.length).toBeLessThanOrEqual(500);
    });
  });

  describe('deleteClawbotMessage', () => {
    it('should return early for empty userId or messageId', async () => {
      const { deleteClawbotMessage } = await import('../services/databaseService');

      await deleteClawbotMessage('', 'msg-1');
      await deleteClawbotMessage('user-123', '');

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should delete message from localStorage', async () => {
      const existing = [
        { id: 'msg-1', content: 'First', contentType: 'text', sender: 'user', timestamp: 1700000000000 },
        { id: 'msg-2', content: 'Second', contentType: 'text', sender: 'user', timestamp: 1700000001000 },
      ];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existing));

      const { deleteClawbotMessage } = await import('../services/databaseService');
      await deleteClawbotMessage('user-123', 'msg-1');

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
      const [, value] = mockLocalStorage.setItem.mock.calls[0];
      const saved = JSON.parse(value);
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('msg-2');
    });
  });

  describe('getNotificationDisplayContent', () => {
    it('should remove friend request metadata from content', async () => {
      const { getNotificationDisplayContent } = await import('../services/databaseService');
      const content = 'Hello World\n[friend_request_from:]12345678-1234-1234-1234-123456789abc';
      const result = getNotificationDisplayContent(content);
      expect(result).toBe('Hello World');
    });

    it('should return original content without friend request metadata', async () => {
      const { getNotificationDisplayContent } = await import('../services/databaseService');
      const content = 'Simple message';
      const result = getNotificationDisplayContent(content);
      expect(result).toBe('Simple message');
    });
  });

  // ============================================
  // Friend Management Tests
  // ============================================

  describe('getFriends', () => {
    it('should return empty array on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB Error') })),
          })),
        })),
      });

      const { getFriends } = await import('../services/databaseService');
      const result = await getFriends();

      expect(result).toEqual([]);
    });

    it('should return friends list', async () => {
      // Verify that the method calls supabase.from with correct table
      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { friend_id: 'friend-1', name: 'Alice', status: 'online' },
                { friend_id: 'friend-2', name: 'Bob', status: 'offline' },
              ],
              error: null,
            }),
          }),
        }),
      } as any);

      const { getFriends } = await import('../services/databaseService');
      const result = await getFriends();

      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('friend_latest_messages');
    });
  });

  describe('getFriendById', () => {
    it('should return null on error', async () => {
      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
          }),
        }),
      } as any);

      const { getFriendById } = await import('../services/databaseService');
      const result = await getFriendById('friend-1');

      expect(result).toBeNull();
    });

    it('should call supabase with correct parameters', async () => {
      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { friend_id: 'friend-1', name: 'Alice', status: 'online' },
              error: null,
            }),
          }),
        }),
      } as any);

      const { getFriendById } = await import('../services/databaseService');
      await getFriendById('friend-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('friends');
    });
  });

  describe('updateFriendStatus', () => {
    it('should handle errors gracefully', async () => {
      vi.mocked(mockSupabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('Update failed') }),
        }),
      } as any);

      const { updateFriendStatus } = await import('../services/databaseService');
      await expect(updateFriendStatus('friend-1', 'online')).resolves.not.toThrow();
    });

    it('should call supabase update', async () => {
      vi.mocked(mockSupabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      const { updateFriendStatus } = await import('../services/databaseService');
      await updateFriendStatus('friend-1', 'online');

      expect(mockSupabase.from).toHaveBeenCalledWith('friends');
    });
  });

  describe('updateFriendStudyStatus', () => {
    it('should update friend study status', async () => {
      vi.mocked(mockSupabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      const { updateFriendStudyStatus } = await import('../services/databaseService');
      await expect(updateFriendStudyStatus('friend-1', true, 3600)).resolves.not.toThrow();
    });
  });

  // ============================================
  // Chat Message Tests
  // ============================================

  describe('getChatHistory', () => {
    it('should return empty array on error', async () => {
      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),
          }),
        }),
      } as any);

      const { getChatHistory } = await import('../services/databaseService');
      const result = await getChatHistory('friend-1');

      expect(result).toEqual([]);
    });

    it('should call supabase to get chat history', async () => {
      vi.mocked(mockSupabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{
                id: 'msg-1',
                conversation_id: 'user_friend-1',
                sender_id: 'current-user-id',
                receiver_id: 'friend-1',
                text: 'Hello',
                is_read: false,
                created_at: '2024-01-01T00:00:00Z',
              }],
              error: null,
            }),
          }),
        }),
      } as any);

      const { getChatHistory } = await import('../services/databaseService');
      const result = await getChatHistory('friend-1');

      expect(result).toHaveLength(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('chat_messages');
    });
  });

  describe('sendMessage', () => {
    it('should return null on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: new Error('Insert failed') })),
          })),
        })),
      });

      const { sendMessage } = await import('../services/databaseService');
      const result = await sendMessage('friend-1', 'user', 'Hello');

      expect(result).toBeNull();
    });

    it('should return message id on success', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'msg-123' }, error: null })),
          })),
        })),
        // Mock unread_counts upsert
        from: vi.fn(() => ({
          upsert: vi.fn(() => Promise.resolve({ error: null })),
        })),
      });

      const { sendMessage } = await import('../services/databaseService');
      const result = await sendMessage('friend-1', 'user', 'Hello');

      expect(result).toBe('msg-123');
    });
  });

  describe('clearChatHistory', () => {
    it('should delete chat messages', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      });

      const { clearChatHistory } = await import('../services/databaseService');
      await expect(clearChatHistory('friend-1')).resolves.not.toThrow();
    });
  });

  describe('markMessagesAsRead', () => {
    it('should call RPC to mark messages as read', async () => {
      const { rpc } = mockSupabase;
      (rpc as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

      const { markMessagesAsRead } = await import('../services/databaseService');
      await expect(markMessagesAsRead('friend-1')).resolves.not.toThrow();
    });
  });

  // ============================================
  // Unread Count Tests
  // ============================================

  describe('getUnreadCounts', () => {
    it('should return empty array on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB Error') })),
        })),
      });

      const { getUnreadCounts } = await import('../services/databaseService');
      const result = await getUnreadCounts();

      expect(result).toEqual([]);
    });

    it('should return unread counts', async () => {
      const mockCounts = [
        { friend_id: 'friend-1', unread_count: 5 },
        { friend_id: 'friend-2', unread_count: 3 },
      ];

      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: mockCounts, error: null })),
        })),
      });

      const { getUnreadCounts } = await import('../services/databaseService');
      const result = await getUnreadCounts();

      expect(result).toEqual(mockCounts);
    });
  });

  describe('getTotalUnreadCount', () => {
    it('should return 0 on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB Error') })),
        })),
      });

      const { getTotalUnreadCount } = await import('../services/databaseService');
      const result = await getTotalUnreadCount();

      expect(result).toBe(0);
    });

    it('should return sum of all unread counts', async () => {
      const mockCounts = [
        { unread_count: 5 },
        { unread_count: 3 },
        { unread_count: 2 },
      ];

      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: mockCounts, error: null })),
        })),
      });

      const { getTotalUnreadCount } = await import('../services/databaseService');
      const result = await getTotalUnreadCount();

      expect(result).toBe(10);
    });
  });

  // ============================================
  // Notification Tests
  // ============================================

  describe('getNotifications', () => {
    it('should return empty array on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB Error') })),
          })),
        })),
      });

      const { getNotifications } = await import('../services/databaseService');
      const result = await getNotifications();

      expect(result).toEqual([]);
    });

    it('should return notifications', async () => {
      const mockNotifications = [
        { id: 'notif-1', title: 'Test', content: 'Hello', is_read: false },
      ];

      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockNotifications, error: null })),
          })),
        })),
      });

      const { getNotifications } = await import('../services/databaseService');
      const result = await getNotifications();

      expect(result).toEqual(mockNotifications);
    });
  });

  describe('markNotificationAsRead', () => {
    it('should update notification', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      });

      const { markNotificationAsRead } = await import('../services/databaseService');
      await expect(markNotificationAsRead('notif-1')).resolves.not.toThrow();
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      });

      const { deleteNotification } = await import('../services/databaseService');
      await expect(deleteNotification('notif-1')).resolves.not.toThrow();
    });
  });

  describe('getUnreadNotificationCount', () => {
    it('should return 0 on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            count: 0,
            error: new Error('DB Error'),
          })),
        })),
      });

      const { getUnreadNotificationCount } = await import('../services/databaseService');
      const result = await getUnreadNotificationCount();

      expect(result).toBe(0);
    });
  });

  // ============================================
  // Mail Tests
  // ============================================

  describe('getMails', () => {
    it('should return empty array on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB Error') })),
          })),
        })),
      });

      const { getMails } = await import('../services/databaseService');
      const result = await getMails();

      expect(result).toEqual([]);
    });

    it('should return mails', async () => {
      const mockMails = [
        { id: 'mail-1', subject: 'Test', is_read: false },
      ];

      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockMails, error: null })),
          })),
        })),
      });

      const { getMails } = await import('../services/databaseService');
      const result = await getMails();

      expect(result).toEqual(mockMails);
    });
  });

  describe('markMailAsRead', () => {
    it('should update mail', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      });

      const { markMailAsRead } = await import('../services/databaseService');
      await expect(markMailAsRead('mail-1')).resolves.not.toThrow();
    });
  });

  describe('deleteMail', () => {
    it('should delete mail', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      });

      const { deleteMail } = await import('../services/databaseService');
      await expect(deleteMail('mail-1')).resolves.not.toThrow();
    });
  });

  describe('getUnreadMailCount', () => {
    it('should return 0 on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            count: null,
            error: new Error('DB Error'),
          })),
        })),
      });

      const { getUnreadMailCount } = await import('../services/databaseService');
      const result = await getUnreadMailCount();

      expect(result).toBe(0);
    });
  });

  // ============================================
  // Study Session Tests
  // ============================================

  describe('getStudySessions', () => {
    it('should return empty array on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB Error') })),
          })),
        })),
      });

      const { getStudySessions } = await import('../services/databaseService');
      const result = await getStudySessions();

      expect(result).toEqual([]);
    });

    it('should return study sessions', async () => {
      const mockSessions = [
        { id: 'session-1', subject: 'Math', duration: 3600 },
      ];

      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockSessions, error: null })),
          })),
        })),
      });

      const { getStudySessions } = await import('../services/databaseService');
      const result = await getStudySessions();

      expect(result).toEqual(mockSessions);
    });

    it('should respect limit parameter', async () => {
      const mockSessions = [
        { id: 'session-1', subject: 'Math', duration: 3600 },
      ];

      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      const selectMock = vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: mockSessions, error: null })),
          })),
        })),
      }));
      mockFrom.mockReturnValue({ select: selectMock });

      const { getStudySessions } = await import('../services/databaseService');
      await getStudySessions(10);

      // Verify limit was called
      expect(selectMock).toHaveBeenCalled();
    });
  });

  describe('createStudySession', () => {
    it('should return null on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: new Error('Insert failed') })),
          })),
        })),
      });

      const { createStudySession } = await import('../services/databaseService');
      const result = await createStudySession('Math', 3600, '2024-01-01T00:00:00Z');

      expect(result).toBeNull();
    });

    it('should return session id on success', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'session-123' }, error: null })),
          })),
        })),
      });

      const { createStudySession } = await import('../services/databaseService');
      const result = await createStudySession('Math', 3600, '2024-01-01T00:00:00Z');

      expect(result).toBe('session-123');
    });
  });

  describe('getTodayStudyTime', () => {
    it('should return 0 on error', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => Promise.resolve({ data: null, error: new Error('DB Error') })),
          })),
        })),
      });

      const { getTodayStudyTime } = await import('../services/databaseService');
      const result = await getTodayStudyTime();

      expect(result).toBe(0);
    });

    it('should return sum of today study durations', async () => {
      const mockSessions = [
        { duration: 1800 },
        { duration: 3600 },
        { duration: 900 },
      ];

      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => Promise.resolve({ data: mockSessions, error: null })),
          })),
        })),
      });

      const { getTodayStudyTime } = await import('../services/databaseService');
      const result = await getTodayStudyTime();

      expect(result).toBe(6300); // 1800 + 3600 + 900
    });
  });

  // ============================================
  // Realtime Subscription Tests
  // ============================================

  describe('subscribeToChatMessages', () => {
    it('should return unsubscribe function', async () => {
      const { subscribeToChatMessages } = await import('../services/databaseService');
      const callback = vi.fn();
      const unsubscribe = await subscribeToChatMessages('friend-1', callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('subscribeToUnreadCounts', () => {
    it('should return unsubscribe function', async () => {
      const { subscribeToUnreadCounts } = await import('../services/databaseService');
      const callback = vi.fn();
      const unsubscribe = await subscribeToUnreadCounts(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('subscribeToNotifications', () => {
    it('should return unsubscribe function', async () => {
      const { subscribeToNotifications } = await import('../services/databaseService');
      const callback = vi.fn();
      const unsubscribe = await subscribeToNotifications(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  // ============================================
  // Friend Request Tests
  // ============================================

  describe('sendFriendRequest', () => {
    it('should throw error for empty account', async () => {
      const { sendFriendRequest } = await import('../services/databaseService');

      await expect(sendFriendRequest('')).rejects.toThrow('请输入用户名或邮箱');
    });

    it('should throw error when user not found', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      // First call: search by email returns null
      // Second call: search by username returns null
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } })),
          })),
        })),
      });

      const { sendFriendRequest } = await import('../services/databaseService');

      await expect(sendFriendRequest('nonexistent')).rejects.toThrow('用户不存在');
    });
  });

  describe('acceptFriendRequest', () => {
    it('should throw error when notification not found', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: new Error('Not found') })),
          })),
        })),
      });

      const { acceptFriendRequest } = await import('../services/databaseService');

      await expect(acceptFriendRequest('invalid-id')).rejects.toThrow('好友请求不存在或已失效');
    });
  });

  describe('rejectFriendRequest', () => {
    it('should throw error when notification not found', async () => {
      const mockFrom = mockSupabase.from as ReturnType<typeof vi.fn>;
      mockFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: new Error('Not found') })),
          })),
        })),
      });

      const { rejectFriendRequest } = await import('../services/databaseService');

      await expect(rejectFriendRequest('invalid-id')).rejects.toThrow('好友请求不存在或已失效');
    });
  });
});
