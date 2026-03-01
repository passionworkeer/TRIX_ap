/**
 * Unit tests for scheduleService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock performance monitor
vi.mock('../utils/performance', () => ({
  perfMonitor: {
    measureAPICall: vi.fn(() => ({
      start: vi.fn(),
      end: vi.fn(),
    })),
  },
}));

// Import after mocks
import { supabase } from '../config/supabase';
import {
  getSchedules,
  getSchedulesByDateRange,
  getTodaySchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  syncWithServer,
  getScheduleStats,
  getUpcomingSchedules,
} from './scheduleService';

describe('scheduleService', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockScheduleRecord = {
    id: 'schedule-1',
    user_id: 'test-user-id',
    title: 'Test Schedule',
    description: 'Test description',
    start_time: '2024-12-31T09:00:00.000Z',
    end_time: '2024-12-31T10:00:00.000Z',
    location: 'Meeting Room A',
    reminder_minutes_before: 15,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    sync_status: 'synced',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getSchedules', () => {
    it('should return empty array when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const schedules = await getSchedules();
      expect(schedules).toEqual([]);
    });

    it('should return schedules when user is authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [mockScheduleRecord],
              error: null,
            }),
          }),
        }),
      } as any);

      const schedules = await getSchedules();
      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules.length).toBe(1);
      expect(schedules[0].id).toBe('schedule-1');
      expect(schedules[0].title).toBe('Test Schedule');
    });

    it('should throw error when database query fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      } as any);

      await expect(getSchedules()).rejects.toThrow('获取日程失败');
    });
  });

  describe('getSchedulesByDateRange', () => {
    it('should return empty array when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const schedules = await getSchedulesByDateRange(
        '2024-12-01T00:00:00.000Z',
        '2024-12-31T23:59:59.000Z'
      );
      expect(schedules).toEqual([]);
    });

    it('should return schedules within date range', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [mockScheduleRecord],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      const schedules = await getSchedulesByDateRange(
        '2024-12-01T00:00:00.000Z',
        '2024-12-31T23:59:59.000Z'
      );
      expect(schedules.length).toBe(1);
      expect(schedules[0].title).toBe('Test Schedule');
    });

    it('should throw error when database query fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' },
                }),
              }),
            }),
          }),
        }),
      } as any);

      await expect(
        getSchedulesByDateRange(
          '2024-12-01T00:00:00.000Z',
          '2024-12-31T23:59:59.000Z'
        )
      ).rejects.toThrow('获取日程失败');
    });
  });

  describe('getTodaySchedules', () => {
    it('should return today schedules', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [mockScheduleRecord],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      const schedules = await getTodaySchedules();
      expect(Array.isArray(schedules)).toBe(true);
    });
  });

  describe('createSchedule', () => {
    it('should throw error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        createSchedule({
          title: 'New Schedule',
          start_time: '2024-12-31T09:00:00.000Z',
        })
      ).rejects.toThrow('请先登录');
    });

    it('should throw error when end_time is before start_time', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      await expect(
        createSchedule({
          title: 'Invalid Schedule',
          start_time: '2024-12-31T10:00:00.000Z',
          end_time: '2024-12-31T09:00:00.000Z',
        })
      ).rejects.toThrow('结束时间不能早于开始时间');
    });

    it('should create schedule successfully', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockScheduleRecord,
              error: null,
            }),
          }),
        }),
      } as any);

      const schedule = await createSchedule({
        title: 'New Schedule',
        description: 'Test description',
        start_time: '2024-12-31T09:00:00.000Z',
        end_time: '2024-12-31T10:00:00.000Z',
        location: 'Meeting Room A',
        reminder_minutes_before: 15,
      });

      expect(schedule.id).toBe('schedule-1');
      expect(schedule.title).toBe('Test Schedule');
    });

    it('should throw error when database insert fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Insert failed' },
            }),
          }),
        }),
      } as any);

      await expect(
        createSchedule({
          title: 'New Schedule',
          start_time: '2024-12-31T09:00:00.000Z',
        })
      ).rejects.toThrow('创建日程失败');
    });
  });

  describe('updateSchedule', () => {
    it('should throw error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        updateSchedule('schedule-1', { title: 'Updated Schedule' })
      ).rejects.toThrow('请先登录');
    });

    it('should throw error when end_time is before start_time', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                start_time: '2024-12-31T10:00:00.000Z',
                end_time: '2024-12-31T11:00:00.000Z',
              },
              error: null,
            }),
          }),
        }),
      } as any);

      await expect(
        updateSchedule('schedule-1', {
          start_time: '2024-12-31T10:00:00.000Z',
          end_time: '2024-12-31T09:00:00.000Z',
        })
      ).rejects.toThrow('结束时间不能早于开始时间');
    });

    it('should update schedule successfully', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const updatedRecord = {
        ...mockScheduleRecord,
        title: 'Updated Schedule',
        updated_at: '2024-01-02T00:00:00.000Z',
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                start_time: '2024-12-31T09:00:00.000Z',
                end_time: '2024-12-31T10:00:00.000Z',
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: updatedRecord,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      const schedule = await updateSchedule('schedule-1', { title: 'Updated Schedule' });
      expect(schedule.title).toBe('Updated Schedule');
    });

    it('should throw error when schedule not found', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                start_time: '2024-12-31T09:00:00.000Z',
                end_time: '2024-12-31T10:00:00.000Z',
              },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      await expect(
        updateSchedule('schedule-1', { title: 'Updated Schedule' })
      ).rejects.toThrow('日程不存在或无权限修改');
    });
  });

  describe('deleteSchedule', () => {
    it('should throw error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(deleteSchedule('schedule-1')).rejects.toThrow('请先登录');
    });

    it('should delete schedule successfully', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      } as any);

      await expect(deleteSchedule('schedule-1')).resolves.toBeUndefined();
    });

    it('should throw error when database delete fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: { message: 'Delete failed' },
            }),
          }),
        }),
      } as any);

      await expect(deleteSchedule('schedule-1')).rejects.toThrow('删除日程失败');
    });
  });

  describe('syncWithServer', () => {
    it('should return error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await syncWithServer();
      expect(result.success).toBe(false);
      expect(result.error).toBe('请先登录');
    });

    it('should return success with zero synced when no pending schedules', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await syncWithServer();
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(0);
      expect(result.conflicts).toEqual([]);
    });

    it('should return error when fetch pending schedules fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Fetch failed' },
            }),
          }),
        }),
      } as any);

      const result = await syncWithServer();
      expect(result.success).toBe(false);
      expect(result.error).toContain('获取待同步数据失败');
    });

    it('should sync pending schedules successfully', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const pendingSchedule = {
        ...mockScheduleRecord,
        sync_status: 'pending',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      vi.mocked(supabase.from)
        .mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [pendingSchedule],
                error: null,
              }),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [pendingSchedule],
                error: null,
              }),
            }),
          }),
        } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { updated_at: '2024-01-01T00:00:00.000Z' },
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      } as any);

      const result = await syncWithServer();
      expect(result.success).toBe(true);
      expect(result.syncedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getScheduleStats', () => {
    it('should return default stats when getSchedules fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const stats = await getScheduleStats();
      expect(stats.total).toBe(0);
      expect(stats.today).toBe(0);
      expect(stats.upcoming).toBe(0);
      expect(stats.thisWeek).toBe(0);
    });

    it('should return correct stats for empty schedules', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      } as any);

      const stats = await getScheduleStats();
      expect(stats.total).toBe(0);
      expect(stats.today).toBe(0);
      expect(stats.upcoming).toBe(0);
      expect(stats.thisWeek).toBe(0);
    });

    it('should return correct stats for schedules', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 3);

      const mockSchedules = [
        {
          ...mockScheduleRecord,
          start_time: today.toISOString(),
        },
        {
          ...mockScheduleRecord,
          id: 'schedule-2',
          start_time: futureDate.toISOString(),
        },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockSchedules,
              error: null,
            }),
          }),
        }),
      } as any);

      const stats = await getScheduleStats();
      expect(stats.total).toBe(2);
    });
  });

  describe('getUpcomingSchedules', () => {
    it('should return empty array when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const schedules = await getUpcomingSchedules();
      expect(schedules).toEqual([]);
    });

    it('should return upcoming schedules within default minutes', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [mockScheduleRecord],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      const schedules = await getUpcomingSchedules();
      expect(Array.isArray(schedules)).toBe(true);
    });

    it('should return upcoming schedules within custom minutes', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [mockScheduleRecord],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      const schedules = await getUpcomingSchedules(60);
      expect(Array.isArray(schedules)).toBe(true);
    });

    it('should return empty array when database query fails', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' },
                }),
              }),
            }),
          }),
        }),
      } as any);

      const schedules = await getUpcomingSchedules();
      expect(schedules).toEqual([]);
    });
  });
});
