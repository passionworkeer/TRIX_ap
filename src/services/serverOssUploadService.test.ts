import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../config/clawbotEndpoints', () => ({
  getClawbotEndpoints: vi.fn(() => ({
    channelUrl: '',
    gatewayUrl: '',
    gatewayToken: '',
    nativeServerUrl: 'http://test-native:8788',
    nativePublicUrl: 'https://chat.example.com',
  })),
}));

vi.mock('./TrixNativeChannelClient', () => ({
  default: {
    getSession: vi.fn(() => ({
      serverUrl: 'https://chat.example.com',
      websocketUrl: 'wss://chat.example.com/ws',
      conversationId: 'conv_123',
      clientToken: 'ct_123',
      clientId: 'web_device_123',
    })),
  },
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

  it('uploads file to Trix Service /api/uploads and maps result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          attachment: {
            id: 'att_123',
            publicUrl: 'https://oss.example.com/trix/a.jpg',
            fileName: 'a.jpg',
            sizeBytes: 321,
            mimeType: 'image/jpeg',
            kind: 'image',
          },
        }),
    });

    const { uploadFileToServerOss } = await import('./serverOssUploadService');
    const file = new File(['img-data'], 'local-name.jpg', { type: 'image/jpeg' });

    const result = await uploadFileToServerOss(file);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://chat.example.com/api/uploads');
    expect(options.method).toBe('POST');
    expect(options.body).toBe(file);
    expect(options.headers['x-file-name']).toBe(encodeURIComponent('local-name.jpg'));
    expect(options.headers['x-mime-type']).toBe('image/jpeg');
    expect(options.headers['x-attachment-kind']).toBe('image');
    expect(options.headers['x-trix-conversation-id']).toBe('conv_123');
    expect(options.headers['x-trix-client-token']).toBe('ct_123');
    expect(result).toEqual({
      url: 'https://oss.example.com/trix/a.jpg',
      objectKey: 'att_123',
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
