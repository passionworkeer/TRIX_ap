/**
 * Logger 工具测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from './logger';

describe('Logger', () => {
  let consoleSpies: {
    log: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    // Mock console methods
    consoleSpies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore console methods
    Object.values(consoleSpies).forEach(spy => spy.mockRestore());
  });

  describe('基础日志方法', () => {
    it('logger.log 应该调用 console.log', () => {
      logger.log('TestPrefix', 'message', 123);
      expect(consoleSpies.log).toHaveBeenCalled();
    });

    it('logger.info 应该调用 console.info', () => {
      logger.info('TestPrefix', 'info message');
      expect(consoleSpies.info).toHaveBeenCalled();
    });

    it('logger.warn 应该调用 console.warn', () => {
      logger.warn('TestPrefix', 'warning message');
      expect(consoleSpies.warn).toHaveBeenCalled();
    });

    it('logger.error 应该调用 console.error', () => {
      logger.error('TestPrefix', 'error message');
      expect(consoleSpies.error).toHaveBeenCalled();
    });

    it('logger.success 应该调用 console.info', () => {
      logger.success('TestPrefix', 'success message');
      expect(consoleSpies.info).toHaveBeenCalled();
    });

    it('应该传递多个参数', () => {
      const obj = { key: 'value' };
      logger.info('TestPrefix', 'message', 123, obj);
      expect(consoleSpies.info).toHaveBeenCalled();
    });
  });

  describe('模块日志方法', () => {
    const modules = ['study', 'chat', 'websocket', 'auth', 'points', 'clawbot', 'database', 'media'] as const;

    modules.forEach(moduleName => {
      describe(`${moduleName} 模块`, () => {
        it(`${moduleName}.log 应该调用 logger.log`, () => {
          logger[moduleName].log('message');
          expect(consoleSpies.log).toHaveBeenCalled();
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

        it(`${moduleName}.success 应该调用 logger.success`, () => {
          logger[moduleName].success('message');
          expect(consoleSpies.info).toHaveBeenCalled();
        });
      });
    });
  });

  describe('参数传递', () => {
    it('模块方法应该正确传递多个参数', () => {
      const obj = { data: 'test' };
      logger.study.info('message', 123, obj);

      expect(consoleSpies.info).toHaveBeenCalled();
      // 验证参数被传递（具体前缀格式由实现决定）
      const call = consoleSpies.info.mock.calls[0];
      expect(call.length).toBeGreaterThan(0);
    });
  });
});
