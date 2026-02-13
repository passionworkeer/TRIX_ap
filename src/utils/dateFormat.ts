/**
 * 日期格式化工具函数
 */

/**
 * 格式化时间为 HH:MM 格式
 */
export function formatTime(isoString: string | Date): string {
  const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * 格式化相对时间 (用于聊天列表)
 * - < 1分钟: "now"
 * - < 1小时: "Xm"
 * - < 24小时: "Xh"
 * - < 7天: "Xd"
 * - >= 7天: "Xw"
 */
export function formatRelative(timestamp: string | Date | null): string {
  if (!timestamp) return '';

  const now = new Date();
  const messageTime = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const diffMs = now.getTime() - messageTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}

/**
 * 检查日期是否是今天
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/**
 * 智能格式化日期
 * - 今天: 显示时间 HH:MM
 * - 昨天: "昨天"
 * - 一周内: 显示星期几
 * - 更早: 显示日期 MM/DD
 */
export function formatSmart(timestamp: string | Date): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) {
    return formatTime(date);
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[date.getDay()];
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}
