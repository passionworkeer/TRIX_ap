/**
 * Storage Service - 统一的本地存储服务
 *
 * 功能：
 * - 异步读写，避免阻塞主线程
 * - 内存缓存层，提升性能
 * - 自动序列化/反序列化
 * - 类型安全
 * - 统一的错误处理
 */

type StorageKey = string;

interface StorageOptions {
  useCache?: boolean; // 是否使用内存缓存
  persistent?: boolean; // 是否持久化到 localStorage
}

class StorageService {
  private cache = new Map<StorageKey, any>();
  private pendingGets = new Map<StorageKey, Promise<any>>();

  /**
   * 获取存储的值
   */
  async get<T = any>(key: StorageKey, options: StorageOptions = {}): Promise<T | null> {
    const { useCache = true } = options;

    // 优先从缓存读取
    if (useCache && this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    // 防止重复请求
    if (this.pendingGets.has(key)) {
      return this.pendingGets.get(key);
    }

    // 异步读取
    const promise = this.readValue<T>(key, useCache);
    this.pendingGets.set(key, promise);

    try {
      const value = await promise;
      return value;
    } finally {
      this.pendingGets.delete(key);
    }
  }

  /**
   * 设置值
   */
  async set(key: StorageKey, value: any, options: StorageOptions = {}): Promise<void> {
    const { useCache = true, persistent = true } = options;

    // 写入缓存
    if (useCache) {
      this.cache.set(key, value);
    }

    // 持久化到 localStorage
    if (persistent) {
      try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
      } catch (error) {
        console.error(`[StorageService] 存储失败: ${key}`, error);

        // 配额超限时的处理
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('[StorageService] localStorage 配额超限，尝试清理');
          this.cleanup();
          // 重试一次
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch (retryError) {
            console.error('[StorageService] 重试存储失败', retryError);
          }
        }
      }
    }
  }

  /**
   * 删除值
   */
  async remove(key: StorageKey): Promise<void> {
    // 清除缓存
    this.cache.delete(key);

    // 删除持久化数据
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`[StorageService] 删除失败: ${key}`, error);
    }
  }

  /**
   * 批量获取
   */
  async getMany<T = any>(keys: StorageKey[]): Promise<Map<StorageKey, T>> {
    const result = new Map<StorageKey, T>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key);
        if (value !== null) {
          result.set(key, value);
        }
      })
    );

    return result;
  }

  /**
   * 批量设置
   */
  async setMany(entries: Map<StorageKey, any> | Record<string, any>): Promise<void> {
    const items = entries instanceof Map
      ? Array.from(entries.entries())
      : Object.entries(entries);

    await Promise.all(
      items.map(([key, value]) => this.set(key, value))
    );
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    // 清空缓存
    this.cache.clear();

    // 清空 localStorage
    try {
      localStorage.clear();
    } catch (error) {
      console.error('[StorageService] 清空失败', error);
    }
  }

  /**
   * 检查键是否存在
   */
  async has(key: StorageKey): Promise<boolean> {
    // 优先检查缓存
    if (this.cache.has(key)) {
      return true;
    }

    // 检查 localStorage
    return localStorage.getItem(key) !== null;
  }

  /**
   * 获取所有键
   */
  async keys(): Promise<StorageKey[]> {
    const localStorageKeys = Object.keys(localStorage);
    const cachedKeys = Array.from(this.cache.keys());

    // 合并并去重
    return Array.from(new Set([...localStorageKeys, ...cachedKeys]));
  }

  /**
   * 获取存储大小（估算）
   */
  async getSize(): Promise<number> {
    let totalSize = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += key.length + value.length;
        }
      }
    }

    return totalSize;
  }

  /**
   * 清理旧数据（LRU 策略）
   */
  private cleanup(): void {
    // 简单的清理策略：删除最旧的 10% 数据
    const keys = Object.keys(localStorage);
    const toRemove = Math.max(1, Math.floor(keys.length * 0.1));

    for (let i = 0; i < toRemove; i++) {
      const key = keys[i];
      if (key && !key.startsWith('clawbot_')) {
        // 保留重要数据
        localStorage.removeItem(key);
      }
    }
  }

  /**
   * 读取值（内部方法）
   */
  private async readValue<T>(key: StorageKey, useCache: boolean): Promise<T | null> {
    try {
      const serialized = localStorage.getItem(key);

      if (serialized === null) {
        return null;
      }

      // 异步解析 JSON（避免阻塞）
      await new Promise(resolve => setTimeout(resolve, 0));

      const value = JSON.parse(serialized);

      // 写入缓存
      if (useCache) {
        this.cache.set(key, value);
      }

      return value as T;
    } catch (error) {
      console.error(`[StorageService] 读取失败: ${key}`, error);

      // 数据损坏，删除
      localStorage.removeItem(key);
      this.cache.delete(key);

      return null;
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// 导出单例
const storageService = new StorageService();

export default storageService;
export { StorageService, type StorageKey, type StorageOptions };

// ============ 常用键定义 ============
export const STORAGE_KEYS = {
  // 用户相关
  USER_ID: 'user_id',
  USER_PROFILE: 'user_profile',

  // Clawbot 相关
  CLAWBOT_DEVICE_ID: 'clawbot_device_id',
  CLAWBOT_DEVICE_TOKEN: 'clawbot_device_token',
  CLAWBOT_PAIRED: 'clawbot_paired',
  CLAWBOT_CHANNEL_URL: 'clawbot_channel_url',
  CLAWBOT_CHANNEL_DEVICE_ID: 'clawbot_channel_device_id',

  // 配置
  THEME: 'theme',
  LANGUAGE: 'language',

  // 临时数据
  TEMP_DATA: 'temp_data',
} as const;
