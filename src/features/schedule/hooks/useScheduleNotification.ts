/**
 * useScheduleNotification - 日程提醒 Hook
 *
 * 使用浏览器 Web Notification API 实现本地通知功能
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Schedule } from '../../../types/workbench';

export interface UseScheduleNotificationOptions {
  schedules: Schedule[];
  onNotificationClick?: (schedule: Schedule) => void;
}

export interface UseScheduleNotificationReturn {
  /** 请求通知权限 */
  requestPermission: () => Promise<boolean>;
  /** 手动触发通知调度 */
  scheduleNotifications: () => void;
  /** 当前通知权限状态 */
  permissionStatus: NotificationPermission | 'unsupported';
}

/**
 * 获取当前通知权限状态
 */
function getPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * 格式化提醒时间显示
 */
function formatReminderTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟后`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `${hours}小时后`;
  } else {
    const days = Math.floor(minutes / 1440);
    return `${days}天后`;
  }
}

export function useScheduleNotification({
  schedules,
  onNotificationClick,
}: UseScheduleNotificationOptions): UseScheduleNotificationReturn {
  // 使用 ref 存储 timers 以便清理
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const permissionRef = useRef<NotificationPermission | 'unsupported'>(getPermissionStatus());

  // 请求通知权限
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      permissionRef.current = 'granted';
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        permissionRef.current = permission;
        return permission === 'granted';
      } catch (error) {
        console.error('Failed to request notification permission:', error);
        return false;
      }
    }

    return false;
  }, []);

  // 清理所有定时器
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((timer) => {
      clearTimeout(timer);
    });
    timersRef.current.clear();
  }, []);

  // 创建单个日程的通知
  const createNotification = useCallback(
    (schedule: Schedule) => {
      if (!schedule.reminder_minutes_before) return;

      const startTime = new Date(schedule.start_time).getTime();
      const reminderTime = startTime - schedule.reminder_minutes_before * 60 * 1000;
      const now = Date.now();

      // 跳过已过期或太接近的通知（1分钟内）
      if (reminderTime <= now || reminderTime - now < 60000) return;

      const delay = reminderTime - now;

      // 如果已有该日程的定时器，先清除
      const existingTimer = timersRef.current.get(schedule.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        try {
          const notification = new Notification(`日程提醒: ${schedule.title}`, {
            body: schedule.description || `将于 ${formatReminderTime(schedule.reminder_minutes_before!)} 开始`,
            icon: '/icon.png',
            tag: schedule.id,
            requireInteraction: true,
            badge: '/icon.png',
            silent: false,
          });

          notification.onclick = () => {
            window.focus();
            onNotificationClick?.(schedule);
            notification.close();
          };

          notification.onclose = () => {
            timersRef.current.delete(schedule.id);
          };
        } catch (error) {
          console.error('Failed to show notification:', error);
        }
      }, delay);

      timersRef.current.set(schedule.id, timer);
    },
    [onNotificationClick]
  );

  // 调度所有日程的通知
  const scheduleNotifications = useCallback(() => {
    // 先清理所有现有定时器
    clearAllTimers();

    const now = Date.now();

    schedules.forEach((schedule) => {
      if (!schedule.reminder_minutes_before) return;

      const startTime = new Date(schedule.start_time).getTime();
      const reminderTime = startTime - schedule.reminder_minutes_before * 60 * 1000;

      // 跳过已过期或太接近的通知
      if (reminderTime <= now || reminderTime - now < 60000) return;

      createNotification(schedule);
    });
  }, [schedules, clearAllTimers, createNotification]);

  // 组件挂载时请求权限并调度通知
  useEffect(() => {
    // 初始化权限状态
    permissionRef.current = getPermissionStatus();

    // 请求权限
    requestPermission().then((granted) => {
      if (granted) {
        scheduleNotifications();
      }
    });

    // 组件卸载时清理所有定时器
    return () => {
      clearAllTimers();
    };
  }, []); // 只在挂载时执行一次

  // 当日程变化时重新调度通知
  useEffect(() => {
    if (permissionRef.current === 'granted') {
      scheduleNotifications();
    }
  }, [schedules, scheduleNotifications]);

  return {
    requestPermission,
    scheduleNotifications,
    permissionStatus: permissionRef.current,
  };
}

export default useScheduleNotification;
