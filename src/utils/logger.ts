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
const formatPrefix = (prefix: string) => {
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
 * 获取颜色辅助函数
 */
const getColor = (key: keyof typeof colors): string => {
  return (colors[key] ?? colors.log) as string;
};

/**
 * 基础日志函数
 */
const log = (level: LogLevel, prefix: string, color: string, ...args: unknown[]) => {
  if (!isDev) return;

  if (typeof window !== 'undefined') {
    // 浏览器环境：带颜色
    const styledPrefix = formatPrefix(prefix);
    console[level](styledPrefix, `color: ${color}; font-weight: bold`, ...args);
  } else {
    // Node.js环境
    console[level](`[${prefix}]`, ...args);
  }
};

/**
 * 创建模块日志工具
 */
const createModuleLogger = (moduleName: string) => ({
  log: (...args: unknown[]) => logger.log(moduleName, ...args),
  info: (...args: unknown[]) => logger.info(moduleName, ...args),
  warn: (...args: unknown[]) => logger.warn(moduleName, ...args),
  error: (...args: unknown[]) => logger.error(moduleName, ...args),
  success: (...args: unknown[]) => logger.success(moduleName, ...args),
});

/**
 * 日志工具对象
 */
export const logger = {
  /**
   * 普通日志
   */
  log: (prefix: string, ...args: unknown[]) => {
    log('log', prefix, getColor('log'), ...args);
  },

  /**
   * 信息日志
   */
  info: (prefix: string, ...args: unknown[]) => {
    log('info', prefix, getColor('info'), ...args);
  },

  /**
   * 警告日志
   */
  warn: (prefix: string, ...args: unknown[]) => {
    log('warn', prefix, getColor('warn'), ...args);
  },

  /**
   * 错误日志（生产环境也会输出）
   */
  error: (prefix: string, ...args: unknown[]) => {
    // 错误日志总是输出
    log('error', prefix, getColor('error'), ...args);
  },

  /**
   * 成功日志
   */
  success: (prefix: string, ...args: unknown[]) => {
    if (!isDev) return;
    log('info', prefix, getColor('success'), ...args);
  },

  /**
   * 便捷方法：Study模块日志
   */
  study: createModuleLogger('Study'),

  /**
   * 便捷方法：Chat模块日志
   */
  chat: createModuleLogger('Chat'),

  /**
   * 便捷方法：WebSocket模块日志
   */
  websocket: createModuleLogger('WebSocket'),

  /**
   * 便捷方法：Auth模块日志
   */
  auth: createModuleLogger('Auth'),

  /**
   * 便捷方法：Points模块日志
   */
  points: createModuleLogger('Points'),

  /**
   * 便捷方法：Clawbot模块日志
   */
  clawbot: createModuleLogger('Clawbot'),

  /**
   * 便捷方法：Database模块日志
   */
  database: createModuleLogger('Database'),

  /**
   * 便捷方法：Media模块日志
   */
  media: createModuleLogger('Media'),
};

export default logger;
