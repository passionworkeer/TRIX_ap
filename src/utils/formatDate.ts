/**
 * 日期格式化工具函数
 */

/**
 * 支持的格式化占位符
 * YYYY - 4位年份
 * MM - 2位月份
 * DD - 2位日期
 * HH - 2位小时 (24小时制)
 * mm - 2位分钟
 * ss - 2位秒
 */

/**
 * 格式化日期字符串
 * @param date - Date 对象
 * @param format - 格式字符串，默认为 "YYYY-MM-DD HH:mm:ss"
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}
