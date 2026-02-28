/**
 * Schedule Store - 日程状态管理
 *
 * 使用 React Context 管理日程的本地状态
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type {
  Schedule,
  CreateScheduleInput,
  UpdateScheduleInput,
} from '../../../types/workbench';
import * as scheduleService from '../../../services/scheduleService';

export type ScheduleFilter = 'all' | 'today' | 'upcoming';

// 日程分组类型
export type ScheduleGroup = 'today' | 'tomorrow' | 'thisWeek' | 'earlier';

// 分组后的日程
export interface GroupedSchedules {
  today: Schedule[];
  tomorrow: Schedule[];
  thisWeek: Schedule[];
  earlier: Schedule[];
}

interface ScheduleContextState {
  // Data
  schedules: Schedule[];
  isLoading: boolean;
  error: string | null;

  // Filter
  filter: ScheduleFilter;

  // Actions
  fetchSchedules: () => Promise<void>;
  addSchedule: (input: CreateScheduleInput) => Promise<Schedule>;
  updateSchedule: (id: string, input: UpdateScheduleInput) => Promise<Schedule>;
  deleteSchedule: (id: string) => Promise<void>;
  setFilter: (filter: ScheduleFilter) => void;
  clearError: () => void;
}

const ScheduleContext = createContext<ScheduleContextState | null>(null);

export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ScheduleFilter>('all');

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await scheduleService.getSchedules();
      setSchedules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取日程失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addSchedule = useCallback(
    async (input: CreateScheduleInput): Promise<Schedule> => {
      setIsLoading(true);
      setError(null);
      try {
        const newSchedule = await scheduleService.createSchedule(input);
        setSchedules((prev) => {
          // 按开始时间排序插入
          const newStartTime = new Date(newSchedule.start_time).getTime();
          const insertIndex = prev.findIndex(
            (s) => new Date(s.start_time).getTime() > newStartTime
          );
          if (insertIndex === -1) {
            return [...prev, newSchedule];
          }
          return [...prev.slice(0, insertIndex), newSchedule, ...prev.slice(insertIndex)];
        });
        setIsLoading(false);
        return newSchedule;
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建日程失败');
        setIsLoading(false);
        throw err;
      }
    },
    []
  );

  const updateSchedule = useCallback(
    async (id: string, input: UpdateScheduleInput): Promise<Schedule> => {
      setError(null);
      try {
        const updatedSchedule = await scheduleService.updateSchedule(id, input);
        setSchedules((prev) =>
          prev.map((schedule) => (schedule.id === id ? updatedSchedule : schedule))
        );
        return updatedSchedule;
      } catch (err) {
        setError(err instanceof Error ? err.message : '更新日程失败');
        throw err;
      }
    },
    []
  );

  const deleteSchedule = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await scheduleService.deleteSchedule(id);
      setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除日程失败');
      throw err;
    }
  }, []);

  const handleSetFilter = useCallback((newFilter: ScheduleFilter) => {
    setFilter(newFilter);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: ScheduleContextState = {
    schedules,
    isLoading,
    error,
    filter,
    fetchSchedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    setFilter: handleSetFilter,
    clearError,
  };

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
};

/**
 * Hook to use the schedule store
 */
export function useScheduleStore(): ScheduleContextState {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useScheduleStore must be used within a ScheduleProvider');
  }
  return context;
}

/**
 * 判断日程是否在指定日期范围内
 */
function isInRange(schedule: Schedule, start: Date, end: Date): boolean {
  const scheduleTime = new Date(schedule.start_time);
  return scheduleTime >= start && scheduleTime < end;
}

/**
 * 获取今天的开始和结束时间
 */
function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * 获取明天的开始和结束时间
 */
function getTomorrowRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * 获取本周的结束时间（今天 + 7天）
 */
function getWeekEnd(): Date {
  const { start } = getTodayRange();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}

/**
 * 过滤日程
 */
function filterSchedules(schedules: Schedule[], filter: ScheduleFilter): Schedule[] {
  const now = new Date();

  switch (filter) {
    case 'today': {
      const { start, end } = getTodayRange();
      return schedules.filter((s) => isInRange(s, start, end));
    }
    case 'upcoming': {
      const weekEnd = getWeekEnd();
      return schedules.filter((s) => {
        const scheduleTime = new Date(s.start_time);
        return scheduleTime >= now && scheduleTime < weekEnd;
      });
    }
    case 'all':
    default:
      return schedules;
  }
}

/**
 * 按日期分组日程
 */
function groupSchedules(schedules: Schedule[]): GroupedSchedules {
  const { start: todayStart, end: todayEnd } = getTodayRange();
  const { start: tomorrowStart, end: tomorrowEnd } = getTomorrowRange();
  const weekEnd = getWeekEnd();

  const result: GroupedSchedules = {
    today: [],
    tomorrow: [],
    thisWeek: [],
    earlier: [],
  };

  for (const schedule of schedules) {
    const scheduleTime = new Date(schedule.start_time);

    if (scheduleTime < todayStart) {
      // 过去的日程
      result.earlier.push(schedule);
    } else if (scheduleTime >= todayStart && scheduleTime < todayEnd) {
      result.today.push(schedule);
    } else if (scheduleTime >= tomorrowStart && scheduleTime < tomorrowEnd) {
      result.tomorrow.push(schedule);
    } else if (scheduleTime >= tomorrowEnd && scheduleTime < weekEnd) {
      result.thisWeek.push(schedule);
    } else if (scheduleTime >= weekEnd) {
      // 超过一周的放到 earlier
      result.earlier.push(schedule);
    }
  }

  return result;
}

/**
 * 选择器：获取过滤后的日程
 */
export function useFilteredSchedules(): Schedule[] {
  const { schedules, filter } = useScheduleStore();
  return useMemo(() => filterSchedules(schedules, filter), [schedules, filter]);
}

/**
 * 选择器：获取分组后的日程
 */
export function useGroupedSchedules(): GroupedSchedules {
  const filteredSchedules = useFilteredSchedules();
  return useMemo(() => groupSchedules(filteredSchedules), [filteredSchedules]);
}

/**
 * 选择器：获取日程统计信息
 */
export function useScheduleStats() {
  const { schedules } = useScheduleStore();
  const now = new Date();
  const { start: todayStart, end: todayEnd } = getTodayRange();
  const weekEnd = getWeekEnd();

  return useMemo(
    () => ({
      total: schedules.length,
      today: schedules.filter((s) => isInRange(s, todayStart, todayEnd)).length,
      upcoming: schedules.filter((s) => new Date(s.start_time) >= now).length,
      thisWeek: schedules.filter((s) => isInRange(s, todayStart, weekEnd)).length,
    }),
    [schedules, now, todayStart, todayEnd, weekEnd]
  );
}
