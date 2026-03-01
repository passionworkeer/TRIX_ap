/**
 * Unit tests for studySessionService
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
            limit: vi.fn()
          })),
          gte: vi.fn()
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      }))
    }))
  }
}));

// Import after mocks
import { supabase } from '../config/supabase';
import { getStudySessions, createStudySession, getTodayStudyTime } from './studySessionService';

describe('studySessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // getStudySessions Tests
  // ============================================

  describe('getStudySessions', () => {
    it('should return study sessions successfully', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-123',
          subject: 'Mathematics',
          duration: 60,
          started_at: '2024-01-15T10:00:00Z',
          ended_at: '2024-01-15T11:00:00Z',
          notes: 'Chapter 5',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: 'session-2',
          user_id: 'user-123',
          subject: 'Physics',
          duration: 45,
          started_at: '2024-01-14T14:00:00Z',
          ended_at: '2024-01-14T14:45:00Z',
          notes: null,
          created_at: '2024-01-14T14:00:00Z'
        }
      ];

      // Mock auth.getSession
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      // Mock query chain
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockSessions,
            error: null
          })
        })
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as any);

      const result = await getStudySessions();

      expect(result).toHaveLength(2);
      expect(result[0].subject).toBe('Mathematics');
      expect(result[1].subject).toBe('Physics');
    });

    it('should return empty array when no sessions exist', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as any);

      const result = await getStudySessions();

      expect(result).toHaveLength(0);
    });

    it('should apply limit when provided', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      const mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-123',
          subject: 'Mathematics',
          duration: 60,
          started_at: '2024-01-15T10:00:00Z',
          ended_at: '2024-01-15T11:00:00Z',
          notes: null,
          created_at: '2024-01-15T10:00:00Z'
        }
      ];

      const mockLimit = vi.fn().mockResolvedValue({
        data: mockSessions,
        error: null
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: mockLimit
          })
        })
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as any);

      const result = await getStudySessions(5);

      expect(mockLimit).toHaveBeenCalledWith(5);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when query fails', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Query failed')
          })
        })
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as any);

      const result = await getStudySessions();

      expect(result).toHaveLength(0);
    });

    it('should return empty array when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getStudySessions();

      expect(result).toHaveLength(0);
    });

    it('should return empty array when session check fails', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: null,
        error: new Error('Auth error')
      });

      const result = await getStudySessions();

      expect(result).toHaveLength(0);
    });
  });

  // ============================================
  // createStudySession Tests
  // ============================================

  describe('createStudySession', () => {
    it('should create study session successfully', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'new-session-id' },
              error: null
            })
          })
        })
      } as any);

      const result = await createStudySession('Mathematics', 60, '2024-01-15T10:00:00Z', '2024-01-15T11:00:00Z', 'Chapter 5');

      expect(result).toBe('new-session-id');
    });

    it('should create session without optional fields', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'new-session-id' },
              error: null
            })
          })
        })
      } as any);

      const result = await createStudySession('Physics', 45, '2024-01-15T14:00:00Z');

      expect(result).toBe('new-session-id');
    });

    it('should return null when insert fails', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Insert failed')
            })
          })
        })
      } as any);

      const result = await createStudySession('Mathematics', 60, '2024-01-15T10:00:00Z');

      expect(result).toBeNull();
    });

    it('should return null on exception', async () => {
      vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('Network error'));

      const result = await createStudySession('Mathematics', 60, '2024-01-15T10:00:00Z');

      expect(result).toBeNull();
    });

    it('should return null when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await createStudySession('Mathematics', 60, '2024-01-15T10:00:00Z');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // getTodayStudyTime Tests
  // ============================================

  describe('getTodayStudyTime', () => {
    it('should return total duration of today sessions', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      const mockSessions = [
        { duration: 60 },
        { duration: 45 },
        { duration: 30 }
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({
              data: mockSessions,
              error: null
            })
          })
        })
      } as any);

      const result = await getTodayStudyTime();

      expect(result).toBe(135); // 60 + 45 + 30
    });

    it('should return 0 when no sessions today', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      } as any);

      const result = await getTodayStudyTime();

      expect(result).toBe(0);
    });

    it('should return 0 when query fails', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Query failed')
            })
          })
        })
      } as any);

      const result = await getTodayStudyTime();

      expect(result).toBe(0);
    });

    it('should return 0 on exception', async () => {
      vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('Network error'));

      const result = await getTodayStudyTime();

      expect(result).toBe(0);
    });

    it('should return 0 when user not logged in', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getTodayStudyTime();

      expect(result).toBe(0);
    });

    it('should call gte with today date', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-123' }
          }
        },
        error: null
      });

      const mockGte = vi.fn().mockResolvedValue({
        data: [],
        error: null
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: mockGte
          })
        })
      } as any);

      await getTodayStudyTime();

      // Verify gte was called with 'started_at' and a date string representing today
      expect(mockGte).toHaveBeenCalledWith('started_at', expect.any(String));
    });
  });
});
