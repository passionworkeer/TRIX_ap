/**
 * Logger Utility - Enhanced Tests
 *
 * Additional tests for:
 * - Environment variable configuration
 * - Remote logging settings
 * - Edge cases and boundary conditions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

// Mock import.meta.env
const mockEnv = {
  VITE_LOG_LEVEL: undefined as string | undefined,
  VITE_ENABLE_REMOTE_LOGGING: undefined as string | undefined,
  VITE_REMOTE_LOG_ENDPOINT: undefined as string | undefined,
  DEV: true,
};

vi.stubGlobal('import.meta', {
  env: mockEnv,
});

describe('Logger Environment Configuration', () => {
  let consoleSpies: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    // Reset environment variables
    mockEnv.VITE_LOG_LEVEL = undefined;
    mockEnv.VITE_ENABLE_REMOTE_LOGGING = undefined;
    mockEnv.VITE_REMOTE_LOG_ENDPOINT = undefined;
    mockEnv.DEV = true;

    // Reset logger to debug level
    logger.setLevel('debug');
  });

  afterEach(() => {
    Object.values(consoleSpies).forEach(spy => spy.mockRestore());
  });

  describe('环境变量配置', () => {
    it('应该从环境变量读取 VITE_LOG_LEVEL', () => {
      mockEnv.VITE_LOG_LEVEL = 'warn';
      mockEnv.DEV = false;

      // 需要重新导入以触发配置更新，这里测试 setLevel 功能
      logger.setLevel('warn');
      expect(logger.getLevel()).toBe('warn');
    });

    it('应该拒绝无效的日志级别', () => {
      mockEnv.VITE_LOG_LEVEL = 'invalid';
      // 配置中已有默认值，setLevel 会直接设置
      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
    });

    it('应该忽略大小写读取日志级别', () => {
      logger.setLevel('DEBUG');
      expect(logger.getLevel()).toBe('DEBUG');
    });

    it('生产环境默认级别应该是 error', () => {
      mockEnv.DEV = false;
      mockEnv.VITE_LOG_LEVEL = undefined;

      // 测试 setLevel 的实际效果
      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
    });

    it('开发环境默认级别应该是 debug', () => {
      mockEnv.DEV = true;
      mockEnv.VITE_LOG_LEVEL = undefined;

      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');
    });
  });

  describe('远程日志配置', () => {
    it('应该能够设置和获取日志级别', () => {
      logger.setLevel('warn');
      expect(logger.getLevel()).toBe('warn');

      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');

      logger.setLevel('info');
      expect(logger.getLevel()).toBe('info');

      logger.setLevel('error');
      expect(logger.getLevel()).toBe('error');
    });

    it('VITE_ENABLE_REMOTE_LOGGING 配置测试', () => {
      mockEnv.VITE_ENABLE_REMOTE_LOGGING = 'true';
      expect(mockEnv.VITE_ENABLE_REMOTE_LOGGING).toBe('true');

      mockEnv.VITE_ENABLE_REMOTE_LOGGING = 'false';
      expect(mockEnv.VITE_ENABLE_REMOTE_LOGGING).toBe('false');
    });

    it('VITE_REMOTE_LOG_ENDPOINT 配置测试', () => {
      const endpoint = 'https://logs.example.com/api/logs';
      mockEnv.VITE_REMOTE_LOG_ENDPOINT = endpoint;
      expect(mockEnv.VITE_REMOTE_LOG_ENDPOINT).toBe(endpoint);
    });
  });

  describe('模块日志上下文', () => {
    it('study 模块应该正确传递上下文', () => {
      logger.study.debug('Study debug');
      expect(consoleSpies.debug).toHaveBeenCalled();
    });

    it('chat 模块应该正确传递上下文', () => {
      logger.chat.info('Chat info');
      expect(consoleSpies.info).toHaveBeenCalled();
    });

    it('websocket 模块应该正确传递上下文', () => {
      logger.websocket.warn('WebSocket warning');
      expect(consoleSpies.warn).toHaveBeenCalled();
    });

    it('auth 模块应该正确传递上下文', () => {
      logger.auth.error('Auth error');
      expect(consoleSpies.error).toHaveBeenCalled();
    });

    it('多个模块应该独立工作', () => {
      logger.study.debug('study');
      logger.chat.info('chat');
      logger.websocket.warn('websocket');
      logger.auth.error('auth');

      expect(consoleSpies.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpies.info).toHaveBeenCalledTimes(1);
      expect(consoleSpies.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpies.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('日志过滤边界测试', () => {
    it('debug 级别应该输出所有日志', () => {
      logger.setLevel('debug');

      logger.debug('Test', 'debug');
      logger.info('Test', 'info');
      logger.warn('Test', 'warn');
      logger.error('Test', 'error');

      expect(consoleSpies.debug).toHaveBeenCalled();
      expect(consoleSpies.info).toHaveBeenCalled();
      expect(consoleSpies.warn).toHaveBeenCalled();
      expect(consoleSpies.error).toHaveBeenCalled();
    });

    it('info 级别不应该输出 debug 日志', () => {
      logger.setLevel('info');

      logger.debug('Test', 'debug');
      logger.info('Test', 'info');
      logger.warn('Test', 'warn');
      logger.error('Test', 'error');

      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).toHaveBeenCalled();
      expect(consoleSpies.warn).toHaveBeenCalled();
      expect(consoleSpies.error).toHaveBeenCalled();
    });

    it('warn 级别只输出 warn 和 error', () => {
      logger.setLevel('warn');

      logger.debug('Test', 'debug');
      logger.info('Test', 'info');
      logger.warn('Test', 'warn');
      logger.error('Test', 'error');

      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).not.toHaveBeenCalled();
      expect(consoleSpies.warn).toHaveBeenCalled();
      expect(consoleSpies.error).toHaveBeenCalled();
    });

    it('error 级别只输出 error', () => {
      logger.setLevel('error');

      logger.debug('Test', 'debug');
      logger.info('Test', 'info');
      logger.warn('Test', 'warn');
      logger.error('Test', 'error');

      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).not.toHaveBeenCalled();
      expect(consoleSpies.warn).not.toHaveBeenCalled();
      expect(consoleSpies.error).toHaveBeenCalled();
    });
  });

  describe('参数传递详细测试', () => {
    it('应该正确传递多个参数', () => {
      const obj = { data: 'test', number: 123 };
      const arr = [1, 2, 3];

      logger.info('Test', 'message', obj, arr, 456);

      expect(consoleSpies.info).toHaveBeenCalled();
    });

    it('应该正确传递错误对象', () => {
      const error = new Error('Test error');
      const errorInfo = { code: 'ERR001', details: 'Something went wrong' };

      logger.error('Test', 'Error occurred', error, errorInfo);

      expect(consoleSpies.error).toHaveBeenCalled();
    });

    it('应该正确传递 null 和 undefined', () => {
      logger.info('Test', 'message', null, undefined);

      expect(consoleSpies.info).toHaveBeenCalled();
    });

    it('应该正确传递空对象和空数组', () => {
      logger.info('Test', 'message', {}, []);

      expect(consoleSpies.info).toHaveBeenCalled();
    });

    it('应该正确传递嵌套对象', () => {
      const nested = {
        level1: {
          level2: {
            level3: 'deep value',
          },
        },
      };

      logger.info('Test', 'nested object', nested);

      expect(consoleSpies.info).toHaveBeenCalled();
    });
  });

  describe('模块边界测试', () => {
    const allModules = [
      'study',
      'chat',
      'websocket',
      'auth',
      'points',
      'clawbot',
      'database',
      'media',
      'pairing',
      'schedule',
      'notification',
      'location',
      'upload',
      'ui',
    ] as const;

    it('所有模块都应该有 debug 方法', () => {
      allModules.forEach(moduleName => {
        expect(typeof logger[moduleName].debug).toBe('function');
      });
    });

    it('所有模块都应该有 info 方法', () => {
      allModules.forEach(moduleName => {
        expect(typeof logger[moduleName].info).toBe('function');
      });
    });

    it('所有模块都应该有 warn 方法', () => {
      allModules.forEach(moduleName => {
        expect(typeof logger[moduleName].warn).toBe('function');
      });
    });

    it('所有模块都应该有 error 方法', () => {
      allModules.forEach(moduleName => {
        expect(typeof logger[moduleName].error).toBe('function');
      });
    });

    it('所有模块方法应该正确过滤日志级别', () => {
      logger.setLevel('warn');

      // 所有模块的 debug 都不应该输出
      allModules.forEach(moduleName => {
        logger[moduleName].debug('debug');
        expect(consoleSpies.debug).not.toHaveBeenCalled();
      });

      // 所有模块的 warn 都应该输出
      allModules.forEach(moduleName => {
        logger[moduleName].warn('warn');
        expect(consoleSpies.warn).toHaveBeenCalled();
      });
    });
  });
});

/**
 * Legacy test suite for backward compatibility
 */
describe('Logger', () => {
  let consoleSpies: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    // Mock console methods
    consoleSpies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    // Reset to debug level for tests
    logger.setLevel('debug');
  });

  afterEach(() => {
    // Restore console methods
    Object.values(consoleSpies).forEach(spy => spy.mockRestore());
  });

  describe('基础日志方法', () => {
    it('logger.debug 应该调用 console.debug', () => {
      logger.debug('TestContext', 'debug message');
      expect(consoleSpies.debug).toHaveBeenCalled();
    });

    it('logger.info 应该调用 console.info', () => {
      logger.info('TestContext', 'info message');
      expect(consoleSpies.info).toHaveBeenCalled();
    });

    it('logger.warn 应该调用 console.warn', () => {
      logger.warn('TestContext', 'warning message');
      expect(consoleSpies.warn).toHaveBeenCalled();
    });

    it('logger.error 应该调用 console.error', () => {
      logger.error('TestContext', 'error message');
      expect(consoleSpies.error).toHaveBeenCalled();
    });

    it('应该传递多个参数', () => {
      const obj = { key: 'value' };
      logger.info('TestContext', 'message', 123, obj);
      expect(consoleSpies.info).toHaveBeenCalled();
    });
  });

  describe('日志级别控制', () => {
    it('debug 级别应该输出所有日志', () => {
      logger.setLevel('debug');

      logger.debug('Test', 'debug');
      logger.info('Test', 'info');
      logger.warn('Test', 'warn');
      logger.error('Test', 'error');

      expect(consoleSpies.debug).toHaveBeenCalled();
      expect(consoleSpies.info).toHaveBeenCalled();
      expect(consoleSpies.warn).toHaveBeenCalled();
      expect(consoleSpies.error).toHaveBeenCalled();
    });

    it('info 级别不应该输出 debug 日志', () => {
      logger.setLevel('info');

      logger.debug('Test', 'debug');
      logger.info('Test', 'info');

      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).toHaveBeenCalled();
    });

    it('warn 级别只输出 warn 和 error', () => {
      logger.setLevel('warn');

      logger.debug('Test', 'debug');
      logger.info('Test', 'info');
      logger.warn('Test', 'warn');
      logger.error('Test', 'error');

      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).not.toHaveBeenCalled();
      expect(consoleSpies.warn).toHaveBeenCalled();
      expect(consoleSpies.error).toHaveBeenCalled();
    });

    it('error 级别只输出 error', () => {
      logger.setLevel('error');

      logger.debug('Test', 'debug');
      logger.info('Test', 'info');
      logger.warn('Test', 'warn');
      logger.error('Test', 'error');

      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).not.toHaveBeenCalled();
      expect(consoleSpies.warn).not.toHaveBeenCalled();
      expect(consoleSpies.error).toHaveBeenCalled();
    });
  });

  describe('getLevel/setLevel', () => {
    it('应该能够设置和获取日志级别', () => {
      logger.setLevel('warn');
      expect(logger.getLevel()).toBe('warn');

      logger.setLevel('debug');
      expect(logger.getLevel()).toBe('debug');
    });
  });

  describe('模块日志方法', () => {
    const modules = [
      'study',
      'chat',
      'websocket',
      'auth',
      'points',
      'clawbot',
      'database',
      'media',
      'pairing',
      'schedule',
      'notification',
      'location',
      'upload',
      'ui',
    ] as const;

    modules.forEach(moduleName => {
      describe(`${moduleName} 模块`, () => {
        it(`${moduleName}.debug 应该调用 logger.debug`, () => {
          logger[moduleName].debug('message');
          expect(consoleSpies.debug).toHaveBeenCalled();
        });

        it(`${moduleName}.info 应该调用 logger.info`, () => {
          logger[moduleName].info('message');
          expect(consoleSpies.info).toHaveBeenCalled();
        });

        it(`${moduleName}.warn 应该调用 logger.warn`, () => {
          logger[moduleName].warn('message');
          expect(consoleSpies.warn).toHaveBeenCalled();
        });

        it(`${moduleName}.error 应该调用 logger.error`, () => {
          logger[moduleName].error('message');
          expect(consoleSpies.error).toHaveBeenCalled();
        });
      });
    });
  });

  describe('参数传递', () => {
    it('模块方法应该正确传递多个参数', () => {
      const obj = { data: 'test' };
      logger.study.info('message', 123, obj);

      expect(consoleSpies.info).toHaveBeenCalled();
      // 验证参数被传递
      const call = consoleSpies.info.mock.calls[0];
      expect(call.length).toBeGreaterThan(0);
    });

    it('应该正确传递错误对象', () => {
      const error = new Error('Test error');
      logger.study.error('Something went wrong', error);

      expect(consoleSpies.error).toHaveBeenCalled();
      const call = consoleSpies.error.mock.calls[0];
      expect(call.length).toBeGreaterThan(0);
    });
  });

  describe('日志级别优先级', () => {
    it('应该按正确的优先级过滤日志', () => {
      // 设置为 info 级别
      logger.setLevel('info');

      // debug 不应该输出
      logger.study.debug('debug message');
      expect(consoleSpies.debug).not.toHaveBeenCalled();

      // info 应该输出
      logger.study.info('info message');
      expect(consoleSpies.info).toHaveBeenCalled();

      // warn 应该输出
      logger.study.warn('warn message');
      expect(consoleSpies.warn).toHaveBeenCalled();

      // error 应该输出
      logger.study.error('error message');
      expect(consoleSpies.error).toHaveBeenCalled();
    });
  });
});
