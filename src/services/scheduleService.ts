/**
 * Schedule Service - 日程服务
 *
 * 处理日程的 CRUD 操作和同步逻辑
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import type {
  Schedule,
  CreateScheduleInput,
  UpdateScheduleInput,
  SyncStatus,
} from '../types/workbench';

/**
 * 数据库 Schedule 记录类型
 */
interface ScheduleRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  reminder_minutes_before: number | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
}

/**
 * 将数据库记录转换为 Schedule 类型
 */
function mapRecordToSchedule(record: ScheduleRecord): Schedule {
  return {
    id: record.id,
    user_id: record.user_id,
    title: record.title,
    description: record.description ?? undefined,
    start_time: record.start_time,
    end_time: record.end_time ?? undefined,
    location: record.location ?? undefined,
    reminder_minutes_before: record.reminder_minutes_before ?? undefined,
    created_at: record.created_at,
    updated_at: record.updated_at,
    sync_status: record.sync_status as SyncStatus,
  };
}

/**
 * 获取当前用户的所有日程
 * @returns 日程列表
 */
export async function getSchedules(): Promise<Schedule[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.warn('[ScheduleService] User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true });

    if (error) {
      logger.error('[ScheduleService] Failed to fetch schedules:', error);
      throw new Error(`获取日程失败: ${error.message}`);
    }

    return (data || []).map(mapRecordToSchedule);
  } catch (error) {
    logger.error('[ScheduleService] Error in getSchedules:', error);
    throw error;
  }
}

/**
 * 获取指定日期范围内的日程
 * @param startDate - 开始日期
 * @param endDate - 结束日期
 * @returns 日程列表
 */
export async function getSchedulesByDateRange(
  startDate: string,
  endDate: string
): Promise<Schedule[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      logger.warn('[ScheduleService] User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: true });

    if (error) {
      logger.error('[ScheduleService] Failed to fetch schedules by date range:', error);
      throw new Error(`获取日程失败: ${error.message}`);
    }

    return (data || []).map(mapRecordToSchedule);
  } catch (error) {
    logger.error('[ScheduleService] Error in getSchedulesByDateRange:', error);
    throw error;
  }
}

/**
 * 获取今日日程
 * @returns 今日日程列表
 */
export async function getTodaySchedules(): Promise<Schedule[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  return getSchedulesByDateRange(
    startOfDay.toISOString(),
    endOfDay.toISOString()
  );
}

/**
 * 创建新的日程
 * @param input - 创建输入
 * @returns 创建的日程
 */
export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('请先登录');
    }

    // 验证时间
    if (input.end_time && new Date(input.end_time) < new Date(input.start_time)) {
      throw new Error('结束时间不能早于开始时间');
    }

    const { data, error } = await supabase
      .from('schedules')
      .insert({
        user_id: user.id,
        title: input.title,
        description: input.description ?? null,
        start_time: input.start_time,
        end_time: input.end_time ?? null,
        location: input.location ?? null,
        reminder_minutes_before: input.reminder_minutes_before ?? null,
        sync_status: 'synced',
      })
      .select()
      .single();

    if (error) {
      logger.error('[ScheduleService] Failed to create schedule:', error);
      throw new Error(`创建日程失败: ${error.message}`);
    }

    logger.info(`[ScheduleService] Schedule created: id=${data.id}, user=${user.id}`);

    return mapRecordToSchedule(data);
  } catch (error) {
    logger.error('[ScheduleService] Error in createSchedule:', error);
    throw error;
  }
}

/**
 * 更新日程
 * @param id - 日程 ID
 * @param input - 更新输入
 * @returns 更新后的日程
 */
export async function updateSchedule(
  id: string,
  input: UpdateScheduleInput
): Promise<Schedule> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('请先登录');
    }

    // 构建更新对象
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.start_time !== undefined) {
      updateData.start_time = input.start_time;
    }
    if (input.end_time !== undefined) {
      updateData.end_time = input.end_time;
    }
    if (input.location !== undefined) {
      updateData.location = input.location;
    }
    if (input.reminder_minutes_before !== undefined) {
      updateData.reminder_minutes_before = input.reminder_minutes_before;
    }
    if (input.sync_status !== undefined) {
      updateData.sync_status = input.sync_status;
    }

    // 验证时间
    if (input.start_time || input.end_time) {
      const { data: currentSchedule, error: fetchError } = await supabase
        .from('schedules')
        .select('start_time, end_time')
        .eq('id', id)
        .single();

      if (!fetchError && currentSchedule) {
        const startTime = input.start_time ?? currentSchedule.start_time;
        const endTime = input.end_time ?? currentSchedule.end_time;

        if (endTime && new Date(endTime) < new Date(startTime)) {
          throw new Error('结束时间不能早于开始时间');
        }
      }
    }

    const { data, error } = await supabase
      .from('schedules')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      logger.error('[ScheduleService] Failed to update schedule:', error);
      throw new Error(`更新日程失败: ${error.message}`);
    }

    if (!data) {
      throw new Error('日程不存在或无权限修改');
    }

    logger.info(`[ScheduleService] Schedule updated: id=${id}, user=${user.id}`);

    return mapRecordToSchedule(data);
  } catch (error) {
    logger.error('[ScheduleService] Error in updateSchedule:', error);
    throw error;
  }
}

/**
 * 删除日程
 * @param id - 日程 ID
 */
export async function deleteSchedule(id: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('请先登录');
    }

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      logger.error('[ScheduleService] Failed to delete schedule:', error);
      throw new Error(`删除日程失败: ${error.message}`);
    }

    logger.info(`[ScheduleService] Schedule deleted: id=${id}, user=${user.id}`);
  } catch (error) {
    logger.error('[ScheduleService] Error in deleteSchedule:', error);
    throw error;
  }
}

/**
 * 同步本地变更到服务器
 * 将所有 pending 状态的日程同步到服务器
 * @returns 同步结果
 */
export async function syncWithServer(): Promise<{
  success: boolean;
  syncedCount: number;
  conflicts: Schedule[];
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        syncedCount: 0,
        conflicts: [],
        error: '请先登录',
      };
    }

    // 获取所有 pending 状态的日程
    const { data: pendingSchedules, error: fetchError } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', user.id)
      .eq('sync_status', 'pending');

    if (fetchError) {
      logger.error('[ScheduleService] Failed to fetch pending schedules:', fetchError);
      return {
        success: false,
        syncedCount: 0,
        conflicts: [],
        error: `获取待同步数据失败: ${fetchError.message}`,
      };
    }

    if (!pendingSchedules || pendingSchedules.length === 0) {
      return {
        success: true,
        syncedCount: 0,
        conflicts: [],
      };
    }

    let syncedCount = 0;
    const conflicts: Schedule[] = [];

    for (const schedule of pendingSchedules) {
      // 检查服务器端是否有更新
      const { data: serverSchedule, error: serverError } = await supabase
        .from('schedules')
        .select('updated_at')
        .eq('id', schedule.id)
        .single();

      if (serverError) {
        // 如果找不到，可能是新建的，标记为已同步
        const { error: updateError } = await supabase
          .from('schedules')
          .update({ sync_status: 'synced' })
          .eq('id', schedule.id);

        if (!updateError) {
          syncedCount++;
        }
        continue;
      }

      // 比较更新时间，检查冲突
      const localUpdatedAt = new Date(schedule.updated_at).getTime();
      const serverUpdatedAt = new Date(serverSchedule.updated_at).getTime();

      if (serverUpdatedAt > localUpdatedAt) {
        // 服务器有更新版本，标记为冲突
        await supabase
          .from('schedules')
          .update({ sync_status: 'conflict' })
          .eq('id', schedule.id);

        conflicts.push(mapRecordToSchedule(schedule));
      } else {
        // 标记为已同步
        const { error: updateError } = await supabase
          .from('schedules')
          .update({ sync_status: 'synced' })
          .eq('id', schedule.id);

        if (!updateError) {
          syncedCount++;
        }
      }
    }

    logger.info(
      `[ScheduleService] Sync completed: synced=${syncedCount}, conflicts=${conflicts.length}`
    );

    return {
      success: true,
      syncedCount,
      conflicts,
    };
  } catch (error) {
    logger.error('[ScheduleService] Error in syncWithServer:', error);
    return {
      success: false,
      syncedCount: 0,
      conflicts: [],
      error: error instanceof Error ? error.message : '同步失败',
    };
  }
}

/**
 * 获取日程统计信息
 * @returns 统计信息
 */
export async function getScheduleStats(): Promise<{
  total: number;
  today: number;
  upcoming: number;
  thisWeek: number;
}> {
  try {
    const schedules = await getSchedules();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return {
      total: schedules.length,
      today: schedules.filter(
        (s) => new Date(s.start_time) >= todayStart && new Date(s.start_time) < todayEnd
      ).length,
      upcoming: schedules.filter((s) => new Date(s.start_time) >= now).length,
      thisWeek: schedules.filter(
        (s) => new Date(s.start_time) >= todayStart && new Date(s.start_time) < weekEnd
      ).length,
    };
  } catch (error) {
    logger.error('[ScheduleService] Error in getScheduleStats:', error);
    return {
      total: 0,
      today: 0,
      upcoming: 0,
      thisWeek: 0,
    };
  }
}

/**
 * 获取即将到来的日程（用于提醒）
 * @param minutes - 多少分钟内的日程
 * @returns 即将到来的日程列表
 */
export async function getUpcomingSchedules(minutes: number = 30): Promise<Schedule[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const now = new Date();
    const futureTime = new Date(now.getTime() + minutes * 60 * 1000);

    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', now.toISOString())
      .lte('start_time', futureTime.toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      logger.error('[ScheduleService] Failed to fetch upcoming schedules:', error);
      return [];
    }

    return (data || []).map(mapRecordToSchedule);
  } catch (error) {
    logger.error('[ScheduleService] Error in getUpcomingSchedules:', error);
    return [];
  }
}
