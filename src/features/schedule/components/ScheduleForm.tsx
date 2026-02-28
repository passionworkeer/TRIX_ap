/**
 * ScheduleForm - 日程表单组件
 *
 * 用于创建和编辑日程的表单
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronDown,
  Clock,
  MapPin,
  Save,
  Bell,
  X,
} from 'lucide-react';
import { useNotification } from '../../../hooks/useNotification';
import { useScheduleStore } from '../store/scheduleStore';
import type {
  Schedule,
  CreateScheduleInput,
  UpdateScheduleInput,
} from '../../../types/workbench';

// 提醒时间选项（分钟）
const reminderOptions: { value: number; label: string }[] = [
  { value: 15, label: '15分钟前' },
  { value: 30, label: '30分钟前' },
  { value: 60, label: '1小时前' },
  { value: 120, label: '2小时前' },
  { value: 1440, label: '1天前' },
];

interface ScheduleFormProps {
  /** 编辑模式时传入的日程 */
  schedule?: Schedule | null;
  /** 关闭回调 */
  onClose: () => void;
  /** 成功回调 */
  onSuccess: () => void;
}

interface FormState {
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  reminderMinutes: number | null;
  errors: {
    title?: string;
    startTime?: string;
    endTime?: string;
  };
}

// 获取今天的日期字符串（YYYY-MM-DD）
function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0] ?? '';
}

// 获取默认开始时间（下一个整点）
function getDefaultStartTime(): string {
  const now = new Date();
  const hour = now.getHours() + 1;
  return `${hour.toString().padStart(2, '0')}:00`;
}

// 获取当前时间
function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({ schedule, onClose, onSuccess }) => {
  const { showError } = useNotification();
  const { addSchedule, updateSchedule } = useScheduleStore();
  const isEditing = Boolean(schedule);

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    startDate: getTodayDateString(),
    startTime: getDefaultStartTime(),
    endDate: getTodayDateString(),
    endTime: '',
    location: '',
    reminderMinutes: null,
    errors: {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReminderMenu, setShowReminderMenu] = useState(false);

  // Initialize form with schedule data when editing
  useEffect(() => {
    if (schedule) {
      const startDate = new Date(schedule.start_time);
      const endDate = schedule.end_time ? new Date(schedule.end_time) : null;

      setForm({
        title: schedule.title,
        description: schedule.description ?? '',
        startDate: startDate.toISOString().split('T')[0] ?? '',
        startTime: startDate.toTimeString().slice(0, 5),
        endDate: endDate ? (endDate.toISOString().split('T')[0] ?? '') : getTodayDateString(),
        endTime: endDate ? endDate.toTimeString().slice(0, 5) : '',
        location: schedule.location ?? '',
        reminderMinutes: schedule.reminder_minutes_before ?? null,
        errors: {},
      });
    }
  }, [schedule]);

  // Validation
  const validate = useCallback((): boolean => {
    const errors: FormState['errors'] = {};

    if (!form.title.trim()) {
      errors.title = '请输入标题';
    } else if (form.title.length > 200) {
      errors.title = '标题不能超过200个字符';
    }

    if (!form.startDate || !form.startTime) {
      errors.startTime = '请选择开始时间';
    }

    // 验证结束时间
    if (form.endDate || form.endTime) {
      if (!form.endDate || !form.endTime) {
        errors.endTime = '请选择完整的结束时间';
      } else {
        const startDateTime = new Date(`${form.startDate}T${form.startTime}`);
        const endDateTime = new Date(`${form.endDate}T${form.endTime}`);
        if (endDateTime <= startDateTime) {
          errors.endTime = '结束时间必须晚于开始时间';
        }
      }
    }

    setForm((prev) => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  }, [form.title, form.startDate, form.startTime, form.endDate, form.endTime]);

  // Handle input change
  const handleChange = useCallback(
    (field: keyof FormState, value: string | number | null) => {
      setForm((prev) => ({
        ...prev,
        [field]: value,
        errors:
          field === 'title' || field === 'startTime' || field === 'endTime'
            ? {}
            : prev.errors,
      }));
    },
    []
  );

  // Handle reminder selection
  const handleReminderSelect = useCallback((minutes: number | null) => {
    setForm((prev) => ({ ...prev, reminderMinutes: minutes }));
    setShowReminderMenu(false);
  }, []);

  // Get reminder display text
  const getReminderDisplayText = () => {
    if (!form.reminderMinutes) return '不提醒';
    const option = reminderOptions.find((o) => o.value === form.reminderMinutes);
    return option?.label ?? '不提醒';
  };

  // Handle form submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) {
        return;
      }

      setIsSubmitting(true);

      try {
        const startTime = new Date(`${form.startDate}T${form.startTime}`).toISOString();
        const endTime =
          form.endDate && form.endTime
            ? new Date(`${form.endDate}T${form.endTime}`).toISOString()
            : undefined;

        if (isEditing && schedule) {
          const input: UpdateScheduleInput = {
            title: form.title.trim(),
            description: form.description.trim() || undefined,
            start_time: startTime,
            end_time: endTime,
            location: form.location.trim() || undefined,
            reminder_minutes_before: form.reminderMinutes ?? undefined,
          };
          await updateSchedule(schedule.id, input);
        } else {
          const input: CreateScheduleInput = {
            title: form.title.trim(),
            description: form.description.trim() || undefined,
            start_time: startTime,
            end_time: endTime,
            location: form.location.trim() || undefined,
            reminder_minutes_before: form.reminderMinutes ?? undefined,
          };
          await addSchedule(input);
        }
        onSuccess();
      } catch (err) {
        showError(err instanceof Error ? err.message : '保存失败');
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      validate,
      isEditing,
      schedule,
      form.title,
      form.description,
      form.startDate,
      form.startTime,
      form.endDate,
      form.endTime,
      form.location,
      form.reminderMinutes,
      updateSchedule,
      addSchedule,
      onSuccess,
      showError,
    ]
  );

  // Quick start time options
  const quickStartOptions = [
    { label: '现在', value: getCurrentTime() },
    { label: '下一个整点', value: getDefaultStartTime() },
    { label: '今天 09:00', value: '09:00' },
    { label: '今天 14:00', value: '14:00' },
    { label: '今天 18:00', value: '18:00' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-sm font-medium tracking-wide text-white/90">
            {isEditing ? '编辑日程' : '添加日程'}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5">
          {/* Title */}
          <div className="mb-4">
            <label
              htmlFor="schedule-title"
              className="mb-2 block text-xs font-medium tracking-wide text-white/50"
            >
              标题 <span className="text-rose-400">*</span>
            </label>
            <input
              id="schedule-title"
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="输入日程标题..."
              className={`w-full rounded-xl border bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:ring-1 ${
                form.errors.title
                  ? 'border-rose-400/50 focus:border-rose-400 focus:ring-rose-400/20'
                  : 'border-white/15 focus:border-white/35 focus:ring-blue-500/20'
              }`}
              autoFocus
            />
            {form.errors.title && (
              <p className="mt-1 text-xs text-rose-400">{form.errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div className="mb-4">
            <label
              htmlFor="schedule-description"
              className="mb-2 block text-xs font-medium tracking-wide text-white/50"
            >
              描述
            </label>
            <textarea
              id="schedule-description"
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="添加描述（可选）..."
              rows={2}
              className="w-full resize-none rounded-xl border border-white/15 bg-slate-900/60 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/35 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>

          {/* Start Time */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium tracking-wide text-white/50">
              开始时间 <span className="text-rose-400">*</span>
            </label>
            <div className="flex gap-2">
              {/* Date Picker */}
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="flex-1 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/35"
              />
              {/* Time Picker */}
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => handleChange('startTime', e.target.value)}
                className="w-28 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/35"
              />
            </div>
            {/* Quick time options */}
            <div className="mt-2 flex flex-wrap gap-1">
              {quickStartOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleChange('startTime', option.value)}
                  className={`rounded-lg px-2 py-1 text-[10px] transition hover:bg-white/5 ${
                    form.startTime === option.value
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-white/50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {form.errors.startTime && (
              <p className="mt-1 text-xs text-rose-400">{form.errors.startTime}</p>
            )}
          </div>

          {/* End Time (Optional) */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium tracking-wide text-white/50">
              结束时间 <span className="text-white/30">(可选)</span>
            </label>
            <div className="flex gap-2">
              {/* Date Picker */}
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
                className="flex-1 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/35"
              />
              {/* Time Picker */}
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => handleChange('endTime', e.target.value)}
                className="w-28 rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/35"
              />
            </div>
            {form.errors.endTime && (
              <p className="mt-1 text-xs text-rose-400">{form.errors.endTime}</p>
            )}
          </div>

          {/* Location */}
          <div className="mb-4">
            <label
              htmlFor="schedule-location"
              className="mb-2 block text-xs font-medium tracking-wide text-white/50"
            >
              地点
            </label>
            <div className="relative">
              <MapPin
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              />
              <input
                id="schedule-location"
                type="text"
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="输入地点（可选）..."
                className="w-full rounded-xl border border-white/15 bg-slate-900/60 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/35 focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* Reminder */}
          <div className="mb-5">
            <label className="mb-2 block text-xs font-medium tracking-wide text-white/50">
              提醒
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReminderMenu(!showReminderMenu)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/15 bg-slate-900/60 px-4 py-2.5 text-sm text-white transition hover:border-white/35"
              >
                <div className="flex items-center gap-2">
                  <Bell size={14} className="text-white/50" />
                  <span>{getReminderDisplayText()}</span>
                </div>
                <ChevronDown size={14} className="text-white/40" />
              </button>

              {showReminderMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowReminderMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur-xl"
                  >
                    <button
                      type="button"
                      onClick={() => handleReminderSelect(null)}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition hover:bg-white/5 ${
                        form.reminderMinutes === null
                          ? 'text-white'
                          : 'text-white/60'
                      }`}
                    >
                      不提醒
                      {form.reminderMinutes === null && <Clock size={14} />}
                    </button>
                    {reminderOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleReminderSelect(option.value)}
                        className={`flex w-full items-center justify-between px-4 py-2.5 text-sm transition hover:bg-white/5 ${
                          form.reminderMinutes === option.value
                            ? 'text-white'
                            : 'text-white/60'
                        }`}
                      >
                        {option.label}
                        {form.reminderMinutes === option.value && <Clock size={14} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/8 hover:text-white"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500/80 to-indigo-500/80 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-900/20 transition hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <Save size={14} />
                  {isEditing ? '保存' : '添加'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default React.memo(ScheduleForm);
