import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: vi.fn(() => ({
    channelUrl: 'ws://test-channel:8765',
    gatewayUrl: 'ws://test-gateway:18789',
    gatewayToken: 'test-token',
  })),
}));

describe('serverOssUploadService', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('uploads file to channel server /upload and maps result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          url: 'https://oss.example.com/trix/a.jpg',
          objectKey: 'trix/a.jpg',
          filename: 'a.jpg',
          size: 321,
          mimeType: 'image/jpeg',
        }),
    });

    const { uploadFileToServerOss } = await import('./serverOssUploadService');
    const file = new File(['img-data'], 'local-name.jpg', { type: 'image/jpeg' });

    const result = await uploadFileToServerOss(file);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://test-channel:8765/upload');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(result).toEqual({
      url: 'https://oss.example.com/trix/a.jpg',
      objectKey: 'trix/a.jpg',
      filename: 'a.jpg',
      size: 321,
      mimeType: 'image/jpeg',
    });
  });

  it('uses legacy VITE_OSS_ENDPOINT as compatibility fallback', async () => {
    vi.stubEnv('VITE_OSS_ENDPOINT', 'https://legacy-upload.example.com');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          url: 'https://oss.example.com/trix/b.jpg',
          contentType: 'image/jpeg',
        }),
    });

    const { uploadFileToServerOss } = await import('./serverOssUploadService');
    const file = new File(['img-data'], 'b.jpg', { type: 'image/jpeg' });

    const result = await uploadFileToServerOss(file);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://legacy-upload.example.com/upload');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.filename).toBe('b.jpg');
  });

  it('respects VITE_USE_SERVER_OSS_UPLOAD switch', async () => {
    vi.stubEnv('VITE_USE_SERVER_OSS_UPLOAD', 'false');
    const disabledModule = await import('./serverOssUploadService');
    expect(disabledModule.isServerOssUploadEnabled()).toBe(false);

    vi.resetModules();
    vi.stubEnv('VITE_USE_SERVER_OSS_UPLOAD', 'true');
    const enabledModule = await import('./serverOssUploadService');
    expect(enabledModule.isServerOssUploadEnabled()).toBe(true);
  });
});
