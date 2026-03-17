/**
 * ScheduleList - 日程列表组件
 *
 * 显示日程列表，支持过滤、分组、编辑、删除操作
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  ChevronDown,
  Clock,
  Edit2,
  Filter,
  MapPin,
  MoreVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotification } from '../../../hooks/useNotification';
import {
  useGroupedSchedules,
  useScheduleStore,
  useFilteredSchedules,
  type ScheduleFilter,
  type ScheduleGroup,
} from '../store/scheduleStore';
import { useScheduleNotification } from '../hooks/useScheduleNotification';
import { usePerformanceTracking } from '../../../utils/performance';
import ScheduleForm from './ScheduleForm';
import type { Schedule } from '../../../types/workbench';

// 过滤选项
const filterOptions: { value: ScheduleFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'upcoming', label: '本周' },
];

// 分组标题配置
const groupConfig: Record<ScheduleGroup, { label: string; order: number }> = {
  today: { label: '今天', order: 0 },
  tomorrow: { label: '明天', order: 1 },
  thisWeek: { label: '本周', order: 2 },
  earlier: { label: '更早/稍后', order: 3 },
};

interface ScheduleItemProps {
  schedule: Schedule;
  onDelete: (id: string) => Promise<void>;
  onEdit: (schedule: Schedule) => void;
}

const ScheduleItem = React.memo<ScheduleItemProps>(({ schedule, onDelete, onEdit }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleDelete = useCallback(async () => {
    try {
      await onDelete(schedule.id);
    } catch {
      // Error handled by store
    }
    setShowMenu(false);
  }, [onDelete, schedule.id]);

  const handleEdit = useCallback(() => {
    onEdit(schedule);
    setShowMenu(false);
  }, [onEdit, schedule]);

  // 格式化时间显示
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  };

  // 计算时间范围显示
  const getTimeDisplay = () => {
    const startTime = formatTime(schedule.start_time);
    if (schedule.end_time) {
      return `${startTime} - ${formatTime(schedule.end_time)}`;
    }
    return startTime;
  };

  // 判断是否已过期
  const isPast = new Date(schedule.start_time) < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex items-start gap-3 rounded-2xl border bg-slate-900/40 p-4 backdrop-blur-md transition-colors ${
        isPast
          ? 'border-white/5 opacity-50'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Time Badge */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-center">
        <span className="text-lg font-semibold text-blue-300">{formatTime(schedule.start_time)}</span>
        <span className="text-[10px] text-blue-400/70">{formatDate(schedule.start_time)}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4
          className={`text-sm font-normal transition-all ${
            isPast ? 'text-white/40 line-through' : 'text-white/90'
          }`}
        >
          {schedule.title}
        </h4>

        {schedule.description && (
          <p className={`mt-1 text-xs text-white/40 line-clamp-2 ${isPast ? 'line-through' : ''}`}>
            {schedule.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Time Range */}
          {schedule.end_time && (
            <span className="flex items-center gap-1 text-[10px] text-white/50">
              <Clock size={10} />
              {getTimeDisplay()}
            </span>
          )}

          {/* Location */}
          {schedule.location && (
            <span className="flex items-center gap-1 text-[10px] text-white/50">
              <MapPin size={10} />
              {schedule.location}
            </span>
          )}

          {/* Reminder */}
          {schedule.reminder_minutes_before && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
              {schedule.reminder_minutes_before}分钟前提醒
            </span>
          )}
        </div>
      </div>

      {/* Actions Menu */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/40 opacity-0 transition hover:bg-white/10 hover:text-white/70 group-hover:opacity-100"
          aria-label="更多操作"
        >
          <MoreVertical size={14} />
        </button>

        <AnimatePresence>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-8 z-20 min-w-[100px] overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur-xl"
              >
                <button
                  onClick={handleEdit}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white"
                >
                  <Edit2 size={12} />
                  编辑
                </button>
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 size={12} />
                  删除
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

ScheduleItem.displayName = 'ScheduleItem';

// 分组标题组件
const GroupHeader: React.FC<{ group: ScheduleGroup; count: number }> = ({ group, count }) => {
  const config = groupConfig[group];
  if (count === 0) return null;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/5 bg-slate-950/80 px-1 py-2 backdrop-blur-sm">
      <Calendar size={12} className="text-blue-400" />
      <span className="text-xs font-medium text-white/70">{config.label}</span>
      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">
        {count}
      </span>
    </div>
  );
};

interface ScheduleListProps {
  onClose?: () => void;
}

const ScheduleList: React.FC<ScheduleListProps> = ({ onClose }) => {
  // Track component render performance
  usePerformanceTracking('ScheduleList');

  const { showError, showSuccess } = useNotification();
  const {
    isLoading,
    error,
    filter,
    schedules,
    fetchSchedules,
    deleteSchedule,
    setFilter,
  } = useScheduleStore();

  const filteredSchedules = useFilteredSchedules();
  const groupedSchedules = useGroupedSchedules();

  // Setup notification for schedules
  const { requestPermission, permissionStatus } = useScheduleNotification({
    schedules,
    onNotificationClick: (schedule) => {
      // Navigate to or focus on the schedule
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Load schedules on mount
  useEffect(() => {
    void fetchSchedules();
  }, [fetchSchedules]);

  // Show error notification
  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteSchedule(id);
        showSuccess('已删除');
      } catch (err) {
        showError(err instanceof Error ? err.message : '删除失败');
      }
    },
    [deleteSchedule, showSuccess, showError]
  );

  const handleEdit = useCallback((schedule: Schedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  }, []);

  const handleAddNew = useCallback(() => {
    setEditingSchedule(null);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingSchedule(null);
  }, []);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    setEditingSchedule(null);
    showSuccess(editingSchedule ? '已更新' : '已添加');
  }, [editingSchedule, showSuccess]);

  // Get current filter label
  const currentFilterLabel = filterOptions.find((f) => f.value === filter)?.label ?? '全部';

  // 检查是否有任何日程
  const hasAnySchedules = filteredSchedules.length > 0;

  // 渲染分组列表
  const renderGroupedSchedules = () => {
    const groups: ScheduleGroup[] = ['today', 'tomorrow', 'thisWeek', 'earlier'];

    return groups.map((group) => {
      const schedules = groupedSchedules[group];
      if (schedules.length === 0) return null;

      return (
        <div key={group} className="mb-4">
          <GroupHeader group={group} count={schedules.length} />
          <div className="mt-2 space-y-2">
            <AnimatePresence mode="popLayout">
              {schedules.map((schedule) => (
                <ScheduleItem
                  key={schedule.id}
                  schedule={schedule}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-5 py-4">
        <div className="flex items-center gap-2"><div className="w-1 h-3.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div><h2 className="text-[16px] font-bold tracking-wider text-white/90">日程安排</h2></div>
        <div className="flex items-center gap-2">
          {/* 漂亮的极简关闭按钮 */}
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
          {/* Notification Permission Button */}
          {permissionStatus !== 'unsupported' && (
            <button
              onClick={() => requestPermission()}
              className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs transition ${
                permissionStatus === 'granted'
                  ? 'border-green-500/30 bg-green-500/10 text-green-400'
                  : 'border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70'
              }`}
              title={permissionStatus === 'granted' ? '通知已开启' : '开启通知'}
            >
              <Bell size={12} />
            </button>
          )}

          {/* Filter Button */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-white/60 transition hover:bg-white/8 hover:text-white/90"
            >
              <Filter size={12} />
              <span>{currentFilterLabel}</span>
              <ChevronDown size={10} />
            </button>

            <AnimatePresence>
              {showFilters && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowFilters(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full z-20 mt-1 min-w-[100px] overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur-xl"
                  >
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilter(option.value);
                          setShowFilters(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-xs transition hover:bg-white/5 ${
                          filter === option.value
                            ? 'text-blue-400 bg-blue-500/10'
                            : 'text-white/60'
                        }`}
                      >
                        {option.label}
                        {filter === option.value && <Calendar size={10} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && filteredSchedules.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-blue-500" />
          </div>
        ) : !hasAnySchedules ? (
          <div className="flex h-56 flex-col items-center justify-center text-center mt-4">
            <div className="mb-4 relative flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] shadow-xl">
              <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-xl"></div>
              <Calendar size={24} className="text-blue-400/80 relative z-10" />
            </div>
            <p className="text-[15px] font-bold tracking-wide text-white/70 mb-1.5">
              {filter === 'all' ? '暂无日程安排' : '没有符合条件的日程'}
            </p>
            <p className="text-[12px] text-white/30 mb-6">开始规划你的重要事项</p>
            {filter === 'all' && (
              <button
                onClick={handleAddNew}
                className="group relative flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600/60 to-indigo-600/60 px-6 py-2.5 text-[13px] font-bold tracking-wider text-white transition-all hover:scale-105 active:scale-95 border border-white/10 shadow-[0_4px_20px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.5)]"
              >
                <div className="absolute inset-0 rounded-full bg-blue-400/20 opacity-0 blur transition-opacity group-hover:opacity-100"></div>
                <Plus size={14} className="relative z-10" />
                <span className="relative z-10 pt-px">添加日程</span>
              </button>
            )}
          </div>
        ) : (
          <motion.div layout className="space-y-2">
            {renderGroupedSchedules()}
          </motion.div>
        )}
      </div>

      {/* Add Button (floating) */}
      {hasAnySchedules && (
        <div className="border-t border-white/10 p-4">
          <button
            onClick={handleAddNew}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500/80 to-indigo-500/80 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-900/20 transition hover:from-blue-500 hover:to-indigo-500"
          >
            <Plus size={16} />
            添加日程
          </button>
        </div>
      )}

      {/* Schedule Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ScheduleForm
            schedule={editingSchedule}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(ScheduleList);
