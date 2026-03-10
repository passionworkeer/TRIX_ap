/**
 * Logger Utility - Enhanced Logging System
 *
 * Features:
 * - Log level control via VITE_LOG_LEVEL environment variable
 * - Timestamp support
 * - Context information
 * - Remote logging capability (optional)
 * - Production filtering
 * - Module-specific loggers
 */

// ============================================================================
// Types
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown[];
}

interface LoggerConfig {
  level: LogLevel;
  enableTimestamp: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
}

// ============================================================================
// Log Level Priority (for filtering)
// ============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ============================================================================
// Configuration
// ============================================================================

const getLogLevel = (): LogLevel => {
  const envLevel = import.meta.env.VITE_LOG_LEVEL?.toLowerCase();
  if (envLevel && ['debug', 'info', 'warn', 'error'].includes(envLevel)) {
    return envLevel as LogLevel;
  }

  // Default based on environment
  return import.meta.env.DEV ? 'debug' : 'error';
};

const config: LoggerConfig = {
  level: getLogLevel(),
  enableTimestamp: true,
  enableRemote: import.meta.env.VITE_ENABLE_REMOTE_LOGGING === 'true',
  remoteEndpoint: import.meta.env.VITE_REMOTE_LOG_ENDPOINT,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a log level should be output based on current configuration
 */
const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.level];
};

/**
 * Format timestamp
 */
const getTimestamp = (): string => {
  if (!config.enableTimestamp) return '';

  const now = new Date();
  const iso = now.toISOString();
  const time = iso.split('T')[1]?.slice(0, -1) ?? iso;
  return time;
};

/**
 * Format log prefix with color and timestamp
 */
const formatPrefix = (context: string, level: LogLevel): string[] => {
  const parts: string[] = [];

  if (config.enableTimestamp) {
    parts.push(`%c${getTimestamp()}`);
  }

  parts.push(`%c[${context}]`);
  parts.push(`%c[${level.toUpperCase()}]`);

  return parts;
};

/**
 * Color mapping for different log levels
 */
const getLogStyles = (level: LogLevel): string[] => {
  const timestampStyle = 'color: #6B7280; font-weight: lighter;';
  const contextStyle = 'color: #3B82F6; font-weight: bold;';

  const levelStyles: Record<LogLevel, string> = {
    debug: 'color: #9CA3AF; font-weight: bold;',
    info: 'color: #3B82F6; font-weight: bold;',
    warn: 'color: #F59E0B; font-weight: bold;',
    error: 'color: #EF4444; font-weight: bold;',
  };

  return [timestampStyle, contextStyle, levelStyles[level]];
};

/**
 * Send log to remote service (optional)
 */
const sendToRemote = async (entry: LogEntry): Promise<void> => {
  if (!config.enableRemote || !config.remoteEndpoint) {
    return;
  }

  try {
    await fetch(config.remoteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entry),
      keepalive: true, // Ensure logs are sent even if page is unloading
    });
  } catch (error) {
    // Avoid infinite loop by using native console
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('[Logger] Failed to send log to remote:', error);
    }
  }
};

// ============================================================================
// Core Logging Functions
// ============================================================================

/**
 * Core log function
 */
const log = (
  level: LogLevel,
  context: string,
  message: string,
  ...data: unknown[]
): void => {
  // Check if this level should be logged
  if (!shouldLog(level)) {
    return;
  }

  // Create log entry for remote logging
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    data: data.length > 0 ? data : undefined,
  };

  // Console output
  if (typeof window !== 'undefined') {
    // Browser environment with colors
    const prefix = formatPrefix(context, level);
    const styles = getLogStyles(level);
    // eslint-disable-next-line no-console
    console[level](...prefix, ...styles, message, ...data);
  } else {
    // Node.js environment
    // eslint-disable-next-line no-console
    console[level](`[${getTimestamp()}] [${context}] [${level.toUpperCase()}]`, message, ...data);
  }

  // Remote logging (fire and forget)
  if (level === 'error' || level === 'warn') {
    // Only send errors and warnings to remote service
    void sendToRemote(entry);
  }
};

// ============================================================================
// Module Logger Factory
// ============================================================================

/**
 * Create a module-specific logger
 */
const createModuleLogger = (moduleName: string) => ({
  debug: (message: string, ...data: unknown[]) => log('debug', moduleName, message, ...data),
  info: (message: string, ...data: unknown[]) => log('info', moduleName, message, ...data),
  warn: (message: string, ...data: unknown[]) => log('warn', moduleName, message, ...data),
  error: (message: string, ...data: unknown[]) => log('error', moduleName, message, ...data),
});

// ============================================================================
// Public Logger API
// ============================================================================

export const logger = {
  /**
   * Set log level dynamically
   */
  setLevel: (level: LogLevel): void => {
    config.level = level;
  },

  /**
   * Get current log level
   */
  getLevel: (): LogLevel => config.level,

  /**
   * Debug level log (development only)
   */
  debug: (context: string, message: string, ...data: unknown[]) => {
    log('debug', context, message, ...data);
  },

  /**
   * Info level log
   */
  info: (context: string, message: string, ...data: unknown[]) => {
    log('info', context, message, ...data);
  },

  /**
   * Warning level log
   */
  warn: (context: string, message: string, ...data: unknown[]) => {
    log('warn', context, message, ...data);
  },

  /**
   * Error level log (always logged)
   */
  error: (context: string, message: string, ...data: unknown[]) => {
    log('error', context, message, ...data);
  },

  /**
   * Module-specific loggers
   */
  study: createModuleLogger('Study'),
  chat: createModuleLogger('Chat'),
  websocket: createModuleLogger('WebSocket'),
  auth: createModuleLogger('Auth'),
  points: createModuleLogger('Points'),
  clawbot: createModuleLogger('Clawbot'),
  gateway: createModuleLogger('Gateway'),
  database: createModuleLogger('Database'),
  media: createModuleLogger('Media'),
  pairing: createModuleLogger('Pairing'),
  schedule: createModuleLogger('Schedule'),
  notification: createModuleLogger('Notification'),
  location: createModuleLogger('Location'),
  upload: createModuleLogger('Upload'),
  ui: createModuleLogger('UI'),
};

// ============================================================================
// Convenience Export
// ============================================================================

export default logger;
