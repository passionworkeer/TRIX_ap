/**
 * 日志工具 - Logger Utility
 *
 * 开发环境：输出日志到控制台
 * 生产环境：不输出日志
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'log' | 'info' | 'warn' | 'error';

/**
 * 格式化日志前缀
 */
const formatPrefix = (prefix: string, color: string) => {
  if (typeof window === 'undefined') {
    return `[${prefix}]`;
  }
  return `%c[${prefix}]`;
};

/**
 * 日志颜色映射
 */
const colors: Record<string, string> = {
  log: '#6B7280',    // gray
  info: '#3B82F6',   // blue
  warn: '#F59E0B',   // yellow
  error: '#EF4444',  // red
  success: '#10B981', // green
};

/**
 * 基础日志函数
 */
const log = (level: LogLevel, prefix: string, color: string, ...args: any[]) => {
  if (!isDev) return;

  if (typeof window !== 'undefined') {
    // 浏览器环境：带颜色
    const styledPrefix = formatPrefix(prefix, color);
    console[level](styledPrefix, `color: ${color}; font-weight: bold`, ...args);
  } else {
    // Node.js环境
    console[level](`[${prefix}]`, ...args);
  }
};

/**
 * 日志工具对象
 */
export const logger = {
  /**
   * 普通日志
   */
  log: (prefix: string, ...args: any[]) => {
    log('log', prefix, colors.log, ...args);
  },

  /**
   * 信息日志
   */
  info: (prefix: string, ...args: any[]) => {
    log('info', prefix, colors.info, ...args);
  },

  /**
   * 警告日志
   */
  warn: (prefix: string, ...args: any[]) => {
    log('warn', prefix, colors.warn, ...args);
  },

  /**
   * 错误日志（生产环境也会输出）
   */
  error: (prefix: string, ...args: any[]) => {
    // 错误日志总是输出
    log('error', prefix, colors.error, ...args);
  },

  /**
   * 成功日志
   */
  success: (prefix: string, ...args: any[]) => {
    if (!isDev) return;
    log('info', prefix, colors.success, ...args);
  },

  /**
   * 便捷方法：Study模块日志
   */
  study: {
    log: (...args: any[]) => logger.log('Study', ...args),
    info: (...args: any[]) => logger.info('Study', ...args),
    warn: (...args: any[]) => logger.warn('Study', ...args),
    error: (...args: any[]) => logger.error('Study', ...args),
    success: (...args: any[]) => logger.success('Study', ...args),
  },

  /**
   * 便捷方法：Chat模块日志
   */
  chat: {
    log: (...args: any[]) => logger.log('Chat', ...args),
    info: (...args: any[]) => logger.info('Chat', ...args),
    warn: (...args: any[]) => logger.warn('Chat', ...args),
    error: (...args: any[]) => logger.error('Chat', ...args),
    success: (...args: any[]) => logger.success('Chat', ...args),
  },

  /**
   * 便捷方法：WebSocket模块日志
   */
  websocket: {
    log: (...args: any[]) => logger.log('WebSocket', ...args),
    info: (...args: any[]) => logger.info('WebSocket', ...args),
    warn: (...args: any[]) => logger.warn('WebSocket', ...args),
    error: (...args: any[]) => logger.error('WebSocket', ...args),
    success: (...args: any[]) => logger.success('WebSocket', ...args),
  },

  /**
   * 便捷方法：Auth模块日志
   */
  auth: {
    log: (...args: any[]) => logger.log('Auth', ...args),
    info: (...args: any[]) => logger.info('Auth', ...args),
    warn: (...args: any[]) => logger.warn('Auth', ...args),
    error: (...args: any[]) => logger.error('Auth', ...args),
    success: (...args: any[]) => logger.success('Auth', ...args),
  },

  /**
   * 便捷方法：Points模块日志
   */
  points: {
    log: (...args: any[]) => logger.log('Points', ...args),
    info: (...args: any[]) => logger.info('Points', ...args),
    warn: (...args: any[]) => logger.warn('Points', ...args),
    error: (...args: any[]) => logger.error('Points', ...args),
    success: (...args: any[]) => logger.success('Points', ...args),
  },
};

export default logger;
