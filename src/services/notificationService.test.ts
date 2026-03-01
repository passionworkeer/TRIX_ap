/**
 * Unit tests for notificationService
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
          order: vi.fn(() => ({
            then: vi.fn(() => ({ data: [], error: null }))
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null }))
      })),
      insert: vi.fn(() => ({
        then: vi.fn(() => ({ data: null, error: null }))
      }))
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn()
    })),
    removeChannel: vi.fn()
  }
}));

// Import after mocks
import { supabase } from '../config/supabase';
import {
  getNotifications,
  markNotificationAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  subscribeToNotifications,
  getMails,
  markMailAsRead,
  deleteMail,
  getUnreadMailCount
} from './notificationService';

describe('notificationService', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // getNotifications Tests
  // ============================================

  describe('getNotifications', () => {
    it('should return empty array when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getNotifications();
      expect(result).toEqual([]);
    });

    it('should return empty array when session has error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Session error' }
      });

      const result = await getNotifications();
      expect(result).toEqual([]);
    });

    it('should return notifications for logged in user', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      const mockNotifications = [
        { id: 'notif-1', title: 'Test Notification', is_read: false, created_at: '2024-01-01' },
        { id: 'notif-2', title: 'Test Notification 2', is_read: true, created_at: '2024-01-02' }
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockNotifications, error: null })
          })
        })
      } as any);

      const result = await getNotifications();
      expect(result).toEqual(mockNotifications);
      expect(supabase.from).toHaveBeenCalledWith('notifications');
    });

    it('should return empty array on database error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } })
          })
        })
      } as any);

      const result = await getNotifications();
      expect(result).toEqual([]);
    });
  });

  // ============================================
  // markNotificationAsRead Tests
  // ============================================

  describe('markNotificationAsRead', () => {
    it('should call supabase update with correct parameters', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate
      } as any);

      await markNotificationAsRead('notif-123');

      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
    });

    it('should handle update error gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } })
        })
      } as any);

      // Should not throw
      await markNotificationAsRead('notif-123');
    });
  });

  // ============================================
  // deleteNotification Tests
  // ============================================

  describe('deleteNotification', () => {
    it('should call supabase delete with correct parameters', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete
      } as any);

      await deleteNotification('notif-123');

      expect(supabase.from).toHaveBeenCalledWith('notifications');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle delete error gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } })
        })
      } as any);

      // Should not throw
      await deleteNotification('notif-123');
    });
  });

  // ============================================
  // getUnreadNotificationCount Tests
  // ============================================

  describe('getUnreadNotificationCount', () => {
    it('should return 0 when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getUnreadNotificationCount();
      expect(result).toBe(0);
    });

    it('should return count of unread notifications', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 5, error: null })
          })
        })
      } as any);

      const result = await getUnreadNotificationCount();
      expect(result).toBe(5);
    });

    it('should return 0 on database error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'Error' } })
          })
        })
      } as any);

      const result = await getUnreadNotificationCount();
      expect(result).toBe(0);
    });
  });

  // ============================================
  // subscribeToNotifications Tests
  // ============================================

  describe('subscribeToNotifications', () => {
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
      const unsubscribe = await subscribeToNotifications(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalled();
    });

    it('should create channel with correct filter', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      };

      vi.mocked(supabase.channel).mockReturnValue(mockChannel as any);

      await subscribeToNotifications(vi.fn());

      expect(supabase.channel).toHaveBeenCalledWith('notifications');
      expect(mockChannel.on).toHaveBeenCalled();
    });

    it('should return empty function on error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: { message: 'Session error' }
      });

      const unsubscribe = await subscribeToNotifications(vi.fn());

      expect(typeof unsubscribe).toBe('function');
      // Should do nothing when called
      unsubscribe();
    });
  });

  // ============================================
  // getMails Tests
  // ============================================

  describe('getMails', () => {
    it('should return empty array when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getMails();
      expect(result).toEqual([]);
    });

    it('should return mails for logged in user', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      const mockMails = [
        { id: 'mail-1', subject: 'Test Mail', is_read: false, created_at: '2024-01-01' },
        { id: 'mail-2', subject: 'Test Mail 2', is_read: true, created_at: '2024-01-02' }
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockMails, error: null })
          })
        })
      } as any);

      const result = await getMails();
      expect(result).toEqual(mockMails);
      expect(supabase.from).toHaveBeenCalledWith('mails');
    });

    it('should return empty array on database error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } })
          })
        })
      } as any);

      const result = await getMails();
      expect(result).toEqual([]);
    });
  });

  // ============================================
  // markMailAsRead Tests
  // ============================================

  describe('markMailAsRead', () => {
    it('should call supabase update with correct parameters', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate
      } as any);

      await markMailAsRead('mail-123');

      expect(supabase.from).toHaveBeenCalledWith('mails');
      expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
    });

    it('should handle update error gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } })
        })
      } as any);

      // Should not throw
      await markMailAsRead('mail-123');
    });
  });

  // ============================================
  // deleteMail Tests
  // ============================================

  describe('deleteMail', () => {
    it('should call supabase delete with correct parameters', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete
      } as any);

      await deleteMail('mail-123');

      expect(supabase.from).toHaveBeenCalledWith('mails');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle delete error gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } })
        })
      } as any);

      // Should not throw
      await deleteMail('mail-123');
    });
  });

  // ============================================
  // getUnreadMailCount Tests
  // ============================================

  describe('getUnreadMailCount', () => {
    it('should return 0 when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getUnreadMailCount();
      expect(result).toBe(0);
    });

    it('should return count of unread mails', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 3, error: null })
          })
        })
      } as any);

      const result = await getUnreadMailCount();
      expect(result).toBe(3);
    });

    it('should return 0 on database error', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'Error' } })
          })
        })
      } as any);

      const result = await getUnreadMailCount();
      expect(result).toBe(0);
    });
  });
});
