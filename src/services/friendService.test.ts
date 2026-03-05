/**
 * Unit tests for friendService - simplified version
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../config/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn() })),
        or: vi.fn()
      })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) })),
      update: vi.fn(() => ({ eq: vi.fn() })),
      delete: vi.fn(() => ({ eq: vi.fn() }))
    }))
  }
}));

vi.mock('../utils/errorHandler', () => ({ handleGlobalError: vi.fn() }));
vi.mock('../utils/logger', () => ({ logger: { chat: { error: vi.fn() } } }));
vi.mock('../lib/validation', () => ({
  FRIEND_VALIDATION: { account: {} },
  validateString: vi.fn(),
  getValidationErrorMessage: vi.fn()
}));

import { supabase } from '../config/supabase';
import {
  getNotificationDisplayContent,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  getFriendById,
  updateFriendStatus,
  updateFriendStudyStatus,
  addFriend
} from './friendService';

describe('friendService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getNotificationDisplayContent', () => {
    it('handles content', () => {
      expect(getNotificationDisplayContent('Test')).toBeDefined();
    });
    it('handles plain content', () => {
      expect(getNotificationDisplayContent('Hello')).toBe('Hello');
    });
  });

  describe('sendFriendRequest', () => {
    it('throws when empty', async () => {
      await expect(sendFriendRequest('')).rejects.toThrow();
    });
  });

  describe('acceptFriendRequest', () => {
    it('throws when not logged in', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
      await expect(acceptFriendRequest('id')).rejects.toThrow('请先登录');
    });
  });

  describe('rejectFriendRequest', () => {
    it('throws when not logged in', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
      await expect(rejectFriendRequest('id')).rejects.toThrow('请先登录');
    });
  });

  describe('getFriends', () => {
    it('returns empty when not logged in', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
      expect(await getFriends()).toEqual([]);
    });
  });

  describe('getFriendById', () => {
    it('returns null when not logged in', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
      expect(await getFriendById('id')).toBeNull();
    });
  });

  describe('updateFriendStatus', () => {
    it('resolves without error', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: '1' } } } });
      await expect(updateFriendStatus('id', 'online')).resolves.not.toThrow();
    });
  });

  describe('updateFriendStudyStatus', () => {
    it('resolves without error', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: { user: { id: '1' } } } });
      await expect(updateFriendStudyStatus('id', true, 100)).resolves.not.toThrow();
    });
  });

  describe('addFriend', () => {
    it('throws when not logged in', async () => {
      (supabase.auth.getSession as any).mockResolvedValue({ data: { session: null } });
      await expect(addFriend('test')).rejects.toThrow();
    });
  });
});
