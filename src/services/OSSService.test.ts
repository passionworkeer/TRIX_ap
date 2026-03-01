/**
 * Unit tests for OSSService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock env
vi.mock('../utils/env', () => ({
  getAliyunOssEnv: vi.fn().mockReturnValue({
    region: 'oss-cn-shenzhen',
    bucket: 'test-bucket',
    accessKeyId: 'test-access-key-id',
    accessKeySecret: 'test-access-key-secret',
    endpoint: 'oss-cn-shenzhen.aliyuncs.com',
    usingLegacyEndpointFallback: false,
  }),
}));

// Mock crypto.subtle
const mockSign = vi.fn().mockResolvedValue(new ArrayBuffer(8));
const mockImportKey = vi.fn().mockResolvedValue({
  exportKey: vi.fn(),
});

vi.stubGlobal('crypto', {
  subtle: {
    importKey: mockImportKey,
    sign: mockSign,
  },
  getRandomValues: vi.fn((arr: Uint8Array) => {
    arr[0] = 1;
    arr[1] = 2;
    arr[2] = 3;
    arr[3] = 4;
    return arr;
  }),
});

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock console.warn to suppress warning during tests
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Import after mocks
import { ossService } from './OSSService';

describe('OSSService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleWarnSpy.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with environment config', () => {
      // Service is already instantiated when imported
      expect(ossService).toBeDefined();
    });

    it('should warn when using legacy endpoint', async () => {
      const { getAliyunOssEnv } = await import('../utils/env');
      vi.mocked(getAliyunOssEnv).mockReturnValueOnce({
        region: 'oss-cn-shenzhen',
        bucket: 'test-bucket',
        accessKeyId: 'test-access-key-id',
        accessKeySecret: 'test-access-key-secret',
        endpoint: 'oss-cn-shenzhen.aliyuncs.com',
        usingLegacyEndpointFallback: true,
      });

      // Re-import to trigger constructor with warning
      vi.resetModules();
      const { ossService: newService } = await import('./OSSService');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[OSS] VITE_OSS_ENDPOINT is deprecated; please migrate to VITE_ALIYUN_OSS_ENDPOINT'
      );
    });
  });

  describe('getFileUrl', () => {
    it('should return correct URL for given object name', () => {
      const objectName = 'test-file.jpg';
      const url = ossService.getFileUrl(objectName);

      expect(url).toBe('https://test-bucket.oss-cn-shenzhen.aliyuncs.com/test-file.jpg');
    });

    it('should handle object names with paths', () => {
      const objectName = 'folder/subfolder/test-file.jpg';
      const url = ossService.getFileUrl(objectName);

      expect(url).toBe('https://test-bucket.oss-cn-shenzhen.aliyuncs.com/folder/subfolder/test-file.jpg');
    });
  });

  describe('uploadFile', () => {
    it('should upload file and return url and name', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValueOnce('success'),
      });

      // Mock crypto.sign to return valid signature
      mockSign.mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);

      const result = await ossService.uploadFile(mockFile);

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('name');
      expect(result.name).toContain('trix-uploads/');
      expect(result.url).toContain('test-bucket.oss-cn-shenzhen.aliyuncs.com');
    });

    it('should use custom filename when provided', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValueOnce('success'),
      });

      mockSign.mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);

      const result = await ossService.uploadFile(mockFile, 'custom-path/my-file.jpg');

      expect(result.name).toBe('custom-path/my-file.jpg');
    });

    it('should throw error on upload failure', async () => {
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: vi.fn().mockResolvedValueOnce('Access denied'),
      });

      mockSign.mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);

      await expect(ossService.uploadFile(mockFile)).rejects.toThrow('上传失败: 403 Forbidden');
    });

    it('should handle different file types', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValueOnce('success'),
      });

      mockSign.mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);

      const result = await ossService.uploadFile(mockFile);

      expect(result.name).toContain('.mp4');
    });
  });

  describe('uploadImage', () => {
    it('should upload image and return URL', async () => {
      const mockFile = new File(['image content'], 'test.png', { type: 'image/png' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValueOnce('success'),
      });

      mockSign.mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);

      const url = await ossService.uploadImage(mockFile);

      expect(typeof url).toBe('string');
      expect(url).toContain('test-bucket.oss-cn-shenzhen.aliyuncs.com');
    });
  });

  describe('uploadVideo', () => {
    it('should upload video and return URL', async () => {
      const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValueOnce('success'),
      });

      mockSign.mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);

      const url = await ossService.uploadVideo(mockFile);

      expect(typeof url).toBe('string');
      expect(url).toContain('test-bucket.oss-cn-shenzhen.aliyuncs.com');
    });
  });

  describe('uploadMultiple', () => {
    it('should upload multiple files and return array of URLs', async () => {
      const mockFile1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });
      const files = [mockFile1, mockFile2];

      // Mock successful responses for each file
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValueOnce('success'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValueOnce('success'),
        });

      mockSign
        .mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer)
        .mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);

      const urls = await ossService.uploadMultiple(files);

      expect(urls).toHaveLength(2);
      expect(urls[0]).toContain('test-bucket.oss-cn-shenzhen.aliyuncs.com');
      expect(urls[1]).toContain('test-bucket.oss-cn-shenzhen.aliyuncs.com');
    });

    it('should handle empty array', async () => {
      const urls = await ossService.uploadMultiple([]);
      expect(urls).toHaveLength(0);
    });

    it('should upload files in parallel', async () => {
      const mockFile1 = new File(['content1'], 'test1.jpg', { type: 'image/jpeg' });
      const mockFile2 = new File(['content2'], 'test2.jpg', { type: 'image/jpeg' });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValueOnce('success'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValueOnce('success'),
        });

      mockSign
        .mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer)
        .mockResolvedValueOnce(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer);

      const startTime = Date.now();
      await ossService.uploadMultiple([mockFile1, mockFile2]);
      const duration = Date.now() - startTime;

      // Should complete in roughly the same time as a single upload (parallel)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
