/**
 * StorageService Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage - must properly simulate storage behavior
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  let length = 0;

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      if (!(key in store)) length++;
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      if (key in store) {
        delete store[key];
        length--;
      }
    }),
    clear: vi.fn(() => {
      store = {};
      length = 0;
    }),
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    }),
    get length() {
      return length;
    },
  };
};

const localStorageMock = createLocalStorageMock();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Import after mock
import storageService from './StorageService';

describe('StorageService', () => {
  beforeEach(() => {
    // Reset localStorage mock
    localStorageMock.getItem.mockReset();
    localStorageMock.setItem.mockReset();
    localStorageMock.removeItem.mockReset();
    localStorageMock.clear.mockReset();
    localStorageMock.key.mockReset();

    // Clear store by calling clear
    localStorage.clear();

    // Clear service cache
    storageService.clearCache();
    vi.clearAllMocks();
  });

  describe('set', () => {
    it('should store value in localStorage', async () => {
      await storageService.set('testKey', 'testValue');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'testKey',
        JSON.stringify('testValue')
      );
    });

    it('should store object values correctly', async () => {
      const obj = { name: 'test', value: 123 };
      await storageService.set('objectKey', obj);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'objectKey',
        JSON.stringify(obj)
      );
    });

    it('should update cache when useCache is true', async () => {
      await storageService.set('cachedKey', 'value', { useCache: true });

      const cached = await storageService.get('cachedKey');
      expect(cached).toBe('value');
    });

    it('should not persist when persistent is false', async () => {
      await storageService.set('nonPersistent', 'value', { persistent: false });

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should retrieve value from localStorage', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify('storedValue'));

      const result = await storageService.get('testKey');

      expect(result).toBe('storedValue');
    });

    it('should return null for non-existent keys', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const result = await storageService.get('nonExistent');

      expect(result).toBeNull();
    });

    it('should return cached value when available', async () => {
      await storageService.set('cachedKey', 'cachedValue', { useCache: true });

      const result = await storageService.get('cachedKey');

      expect(result).toBe('cachedValue');
      expect(localStorage.getItem).not.toHaveBeenCalled();
    });

    it('should bypass cache when useCache is false', async () => {
      // First set the value with cache
      await storageService.set('key1', 'value1', { useCache: true });

      // Now get without cache - should read from localStorage
      // Need to mock localStorage to return the value
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify('value1'));

      const result = await storageService.get('key1', { useCache: false });

      expect(result).toBe('value1');
    });

    it('should parse JSON objects correctly', async () => {
      const obj = { name: 'test', count: 42 };
      vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(obj));

      const result = await storageService.get('objectKey');

      expect(result).toEqual(obj);
    });
  });

  describe('remove', () => {
    it('should remove value from localStorage', async () => {
      await storageService.remove('testKey');

      expect(localStorage.removeItem).toHaveBeenCalledWith('testKey');
    });

    it('should remove from cache', async () => {
      await storageService.set('toRemove', 'value', { useCache: true });
      await storageService.remove('toRemove');

      // After removal, get should return null
      // Need to mock that localStorage.getItem returns null
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const result = await storageService.get('toRemove');
      expect(result).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all localStorage data', async () => {
      await storageService.set('key1', 'value1');
      await storageService.set('key2', 'value2');

      await storageService.clear();

      expect(localStorage.clear).toHaveBeenCalled();
    });

    it('should clear cache', async () => {
      await storageService.set('cached', 'value', { useCache: true });

      await storageService.clear();

      // After clear, get should return null from localStorage
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const result = await storageService.get('cached');
      expect(result).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue('value');

      const result = await storageService.has('testKey');

      expect(result).toBe(true);
    });

    it('should return false for non-existing key', async () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const result = await storageService.has('nonExistent');

      expect(result).toBe(false);
    });

    it('should check cache first', async () => {
      await storageService.set('cachedOnly', 'value', { useCache: true, persistent: false });

      const result = await storageService.has('cachedOnly');

      expect(result).toBe(true);
      expect(localStorage.getItem).not.toHaveBeenCalled();
    });
  });

  describe('keys', () => {
    it('should return all keys from localStorage and cache', async () => {
      // Mock localStorage.key() to return stored keys
      vi.mocked(localStorage.key)
        .mockReturnValueOnce('localKey1')
        .mockReturnValueOnce('localKey2')
        .mockReturnValueOnce(null);

      // Mock localStorage.length to indicate 2 keys
      Object.defineProperty(localStorage, 'length', { value: 2 });

      // Set a cached-only key
      await storageService.set('cachedKey', 'value', { persistent: false });

      const result = await storageService.keys();

      expect(result).toContain('localKey1');
      expect(result).toContain('localKey2');
      expect(result).toContain('cachedKey');
    });
  });

  describe('getMany', () => {
    it('should batch get multiple keys', async () => {
      vi.mocked(localStorage.getItem)
        .mockReturnValueOnce(JSON.stringify('value1'))
        .mockReturnValueOnce(JSON.stringify('value2'))
        .mockReturnValueOnce(null);

      const result = await storageService.getMany(['key1', 'key2', 'key3']);

      expect(result.size).toBe(2);
      expect(result.get('key1')).toBe('value1');
      expect(result.get('key2')).toBe('value2');
      expect(result.has('key3')).toBe(false);
    });
  });

  describe('setMany', () => {
    it('should batch set multiple values from record', async () => {
      await storageService.setMany({ key1: 'value1', key2: 'value2' });

      expect(localStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should batch set multiple values from Map', async () => {
      const map = new Map([
        ['mapKey1', 'mapValue1'],
        ['mapKey2', 'mapValue2'],
      ]);

      await storageService.setMany(map);

      expect(localStorage.setItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSize', () => {
    it('should calculate storage size correctly', async () => {
      // Mock localStorage to have keys
      vi.mocked(localStorage.key)
        .mockReturnValueOnce('key1')
        .mockReturnValueOnce('key2')
        .mockReturnValueOnce(null);

      vi.mocked(localStorage.getItem)
        .mockReturnValueOnce('value1') // key1 (4) + value1 (6) = 10
        .mockReturnValueOnce('value2'); // key2 (4) + value2 (6) = 10

      // Mock length property
      Object.defineProperty(localStorage, 'length', { value: 2 });

      const size = await storageService.getSize();

      expect(size).toBe(20); // 4+6 + 4+6 = 20
    });
  });

  describe('clearCache', () => {
    it('should clear only cache without affecting localStorage', async () => {
      await storageService.set('cached', 'value', { useCache: true });

      storageService.clearCache();

      const result = await storageService.get('cached');
      expect(result).toBeNull();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      await storageService.set('key1', 'value1', { useCache: true });
      await storageService.set('key2', 'value2', { useCache: true });

      const stats = storageService.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });
  });
});
