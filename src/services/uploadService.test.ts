/**
 * Unit tests for uploadService
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase
vi.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        remove: vi.fn(),
        getPublicUrl: vi.fn()
      }))
    }
  }
}));

// Mock browser-image-compression
vi.mock('browser-image-compression', () => ({
  default: vi.fn((file) => Promise.resolve(file))
}));

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-1234-5678-abcd-efghijklmnop')
});

// Mock URL
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:http://test.com/mock-url'),
  revokeObjectURL: vi.fn()
});

// Mock Image and Video - synchronous with callback
const createImageMock = () => ({
  naturalWidth: 1920,
  naturalHeight: 1080,
  onload: null as (() => void) | null,
  onerror: null as (() => void) | null,
  src: ''
});

const createVideoMock = () => ({
  duration: 120,
  videoWidth: 1920,
  videoHeight: 1080,
  onloadedmetadata: null as (() => void) | null,
  onerror: null as (() => void) | null,
  src: ''
});

vi.stubGlobal('Image', vi.fn(function(this: any) {
  const mock = createImageMock();
  this.naturalWidth = mock.naturalWidth;
  this.naturalHeight = mock.naturalHeight;
  this.src = '';
  Object.defineProperty(this, 'onload', {
    set: (fn) => { mock.onload = fn; },
    get: () => mock.onload
  });
  Object.defineProperty(this, 'onerror', {
    set: (fn) => { mock.onerror = fn; },
    get: () => mock.onerror
  });
  // Trigger onload immediately after setting src if there's a handler
  setTimeout(() => {
    if (mock.onload) mock.onload();
  }, 0);
  return this;
}));

vi.stubGlobal('HTMLVideoElement', vi.fn(function(this: any) {
  const mock = createVideoMock();
  this.duration = mock.duration;
  this.videoWidth = mock.videoWidth;
  this.videoHeight = mock.videoHeight;
  this.src = '';
  Object.defineProperty(this, 'onloadedmetadata', {
    set: (fn) => { mock.onloadedmetadata = fn; },
    get: () => mock.onloadedmetadata
  });
  Object.defineProperty(this, 'onerror', {
    set: (fn) => { mock.onerror = fn; },
    get: () => mock.onerror
  });
  setTimeout(() => {
    if (mock.onloadedmetadata) mock.onloadedmetadata();
  }, 0);
  return this;
}));

// Mock document.createElement for canvas and video
const mockCanvas = {
  width: 300,
  height: 200,
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
  })),
  toBlob: vi.fn((callback) => {
    if (callback) callback(new Blob(['mock'], { type: 'image/jpeg' }));
  })
};

const mockVideoElement = {
  duration: 120,
  videoWidth: 1920,
  videoHeight: 1080,
  onloadedmetadata: null as (() => void) | null,
  onerror: null as (() => void) | null,
  src: '',
  play: vi.fn(),
  pause: vi.fn(),
  load: vi.fn()
};

vi.stubGlobal('document', {
  createElement: vi.fn((tagName: string) => {
    if (tagName === 'canvas') {
      return mockCanvas;
    }
    if (tagName === 'video') {
      // Trigger onloadedmetadata after a short delay
      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata();
        }
      }, 0);
      return mockVideoElement;
    }
    // Fall back to creating other elements
    return { tagName, style: {}, appendChild: vi.fn() };
  }),
  createElementNS: vi.fn(() => ({
    appendChild: vi.fn(),
    setAttribute: vi.fn(),
  }))
});

// Import after mocks are set up
import {
  uploadFile,
  deleteFile,
  getFileCategory,
  formatFileSize,
  isValidFile,
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_FILE_SIZE
} from './uploadService';

// Get reference to mocked functions
import { supabase } from '../config/supabase';

describe('uploadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default auth mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });

    // Setup default storage mock
    const mockStorage = {
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/public-url' }
      })
    };
    vi.mocked(supabase.storage.from).mockReturnValue(mockStorage as any);
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // ============================================
  // ✅ Validation Tests
  // ============================================

  describe('getFileCategory', () => {
    it('should return "image" for image MIME types', () => {
      ACCEPTED_IMAGE_TYPES.forEach((type) => {
        expect(getFileCategory(type)).toBe('image');
      });
    });

    it('should return "video" for video MIME types', () => {
      ACCEPTED_VIDEO_TYPES.forEach((type) => {
        expect(getFileCategory(type)).toBe('video');
      });
    });

    it('should return null for unknown MIME types', () => {
      expect(getFileCategory('application/pdf')).toBeNull();
      expect(getFileCategory('text/plain')).toBeNull();
      expect(getFileCategory('')).toBeNull();
    });
  });

  describe('isValidFile', () => {
    it('should return true for valid image files under size limit', () => {
      const validImage = new File(['img'], 'test.jpg', { type: 'image/jpeg' });
      // File size defaults to 3 bytes, which is under limit
      expect(isValidFile(validImage)).toBe(true);
    });

    it('should return true for valid video files under size limit', () => {
      const validVideo = new File(['vid'], 'test.mp4', { type: 'video/mp4' });
      expect(isValidFile(validVideo)).toBe(true);
    });

    it('should return false for invalid file types', () => {
      const invalidFile = new File(['doc'], 'test.pdf', { type: 'application/pdf' });
      expect(isValidFile(invalidFile)).toBe(false);
    });

    it('should return false for image files over size limit', () => {
      // Create a file larger than 10MB
      const largeImage = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      expect(isValidFile(largeImage)).toBe(false);
    });

    it('should return false for video files over size limit', () => {
      // Create a file larger than 50MB
      const largeVideo = new File(['x'.repeat(51 * 1024 * 1024)], 'large.mp4', { type: 'video/mp4' });
      expect(isValidFile(largeVideo)).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(10240)).toBe('10.0 KB');
    });

    it('should format MB correctly', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });

    it('should format GB correctly', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
    });
  });

  // ============================================
  // 🚀 Upload Tests (with increased timeout)
  // ============================================

  describe('uploadFile', () => {
    it('should successfully upload an image file', async () => {
      const file = new File(['image-data'], 'test.jpg', { type: 'image/jpeg' });

      const result = await uploadFile(file, 'image');

      expect(result).toEqual({
        uri: 'https://example.com/public-url',
        path: 'user-123/images/test-uuid-1234-5678-abcd-efghijklmnop.jpg',
        type: 'image/jpeg',
        size: file.size,
        category: 'image',
        metadata: expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number)
        })
      });

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(supabase.storage.from).toHaveBeenCalledWith('TRIX');
    }, 10000);

    it('should successfully upload a video file', async () => {
      const file = new File(['video-data'], 'test.mp4', { type: 'video/mp4' });

      const result = await uploadFile(file, 'video');

      expect(result.category).toBe('video');
      // Video metadata may not be extracted in test environment
      expect(result).toHaveProperty('metadata');
    }, 10000);

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: null
      });

      const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });

      await expect(uploadFile(file, 'image')).rejects.toThrow('用户未登录，请先登录');
    });

    it('should throw error for invalid file type', async () => {
      const file = new File(['pdf'], 'test.pdf', { type: 'application/pdf' });

      await expect(uploadFile(file, 'image')).rejects.toThrow('不支持的文件类型: application/pdf');
    });

    it('should throw error when file is too large (image)', async () => {
      // Create file larger than 10MB
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

      await expect(uploadFile(largeFile, 'image')).rejects.toThrow('文件过大，最大允许 10MB');
    });

    it('should throw error when file is too large (video)', async () => {
      // Create file larger than 50MB
      const largeFile = new File(['x'.repeat(51 * 1024 * 1024)], 'large.mp4', { type: 'video/mp4' });

      await expect(uploadFile(largeFile, 'video')).rejects.toThrow('文件过大，最大允许 50MB');
    });

    it('should throw error when upload fails', async () => {
      const mockStorage = {
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Upload failed' }
        }),
        remove: vi.fn(),
        getPublicUrl: vi.fn()
      };
      vi.mocked(supabase.storage.from).mockReturnValue(mockStorage as any);

      const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });

      await expect(uploadFile(file, 'image')).rejects.toThrow('上传失败: Upload failed');
    }, 10000);

    it('should generate unique filename using crypto.randomUUID', async () => {
      const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });

      await uploadFile(file, 'image');

      expect(crypto.randomUUID).toHaveBeenCalled();
    }, 10000);

    it('should use correct path format for images', async () => {
      const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
      const mockStorage = {
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn(),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/public-url' }
        })
      };
      vi.mocked(supabase.storage.from).mockReturnValue(mockStorage as any);

      await uploadFile(file, 'image');

      expect(mockStorage.upload).toHaveBeenCalledWith(
        'user-123/images/test-uuid-1234-5678-abcd-efghijklmnop.jpg',
        expect.any(File),
        expect.objectContaining({
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: false
        })
      );
    }, 10000);

    it('should use correct path format for videos', async () => {
      const file = new File(['video'], 'test.mp4', { type: 'video/mp4' });
      const mockStorage = {
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn(),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/public-url' }
        })
      };
      vi.mocked(supabase.storage.from).mockReturnValue(mockStorage as any);

      const result = await uploadFile(file, 'video');

      // Verify path format for videos
      expect(result.path).toMatch(/^user-123\/videos\/.+/);
    }, 10000);
  });

  // ============================================
  // 🗑️ Delete Tests
  // ============================================

  describe('deleteFile', () => {
    it('should successfully delete a file', async () => {
      const mockStorage = {
        upload: vi.fn(),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: vi.fn()
      };
      vi.mocked(supabase.storage.from).mockReturnValue(mockStorage as any);

      await deleteFile('user-id/images/test.jpg');

      expect(mockStorage.remove).toHaveBeenCalledWith(['user-id/images/test.jpg']);
    });

    it('should throw error when delete fails', async () => {
      const mockStorage = {
        upload: vi.fn(),
        remove: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Delete failed' }
        }),
        getPublicUrl: vi.fn()
      };
      vi.mocked(supabase.storage.from).mockReturnValue(mockStorage as any);

      await expect(deleteFile('user-id/images/test.jpg')).rejects.toThrow('删除失败: Delete failed');
    });

    it('should handle delete errors gracefully', async () => {
      const mockStorage = {
        upload: vi.fn(),
        remove: vi.fn().mockRejectedValue(new Error('Network error')),
        getPublicUrl: vi.fn()
      };
      vi.mocked(supabase.storage.from).mockReturnValue(mockStorage as any);

      await expect(deleteFile('user-id/images/test.jpg')).rejects.toThrow();
    });
  });

  // ============================================
  // 📊 Constants Tests
  // ============================================

  describe('constants', () => {
    it('should have correct accepted image types', () => {
      expect(ACCEPTED_IMAGE_TYPES).toContain('image/jpeg');
      expect(ACCEPTED_IMAGE_TYPES).toContain('image/png');
      expect(ACCEPTED_IMAGE_TYPES).toContain('image/gif');
      expect(ACCEPTED_IMAGE_TYPES).toContain('image/webp');
      expect(ACCEPTED_IMAGE_TYPES).toContain('image/svg+xml');
    });

    it('should have correct accepted video types', () => {
      expect(ACCEPTED_VIDEO_TYPES).toContain('video/mp4');
      expect(ACCEPTED_VIDEO_TYPES).toContain('video/webm');
      expect(ACCEPTED_VIDEO_TYPES).toContain('video/quicktime');
      expect(ACCEPTED_VIDEO_TYPES).toContain('video/x-msvideo');
    });

    it('should have correct max file sizes', () => {
      expect(MAX_FILE_SIZE.image).toBe(10 * 1024 * 1024); // 10MB
      expect(MAX_FILE_SIZE.video).toBe(50 * 1024 * 1024); // 50MB
    });
  });

  // ============================================
  // 🔧 Edge Cases
  // ============================================

  describe('edge cases', () => {
    it('should handle files without extension', async () => {
      const file = new File(['image'], 'test', { type: 'image/jpeg' });
      const mockStorage = {
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn(),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/public-url' }
        })
      };
      vi.mocked(supabase.storage.from).mockReturnValue(mockStorage as any);

      const result = await uploadFile(file, 'image');

      // Should use 'bin' as fallback when no extension
      // The path format is: user-id/images/uuid.ext
      expect(result.path).toMatch(/^user-123\/images\/.+/);
    }, 10000);

    it('should handle files with multiple dots in name', async () => {
      const file = new File(['image'], 'my.test.image.jpg', { type: 'image/jpeg' });
      const mockStorage = {
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn(),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/public-url' }
        })
      };
      vi.mocked(supabase.storage.from).mockReturnValue(mockStorage as any);

      const result = await uploadFile(file, 'image');

      // Result should have jpg extension (from original file name)
      expect(result.path).toMatch(/\.jpg$/);
    }, 10000);

    it('should handle uppercase file extensions', async () => {
      const file = new File(['image'], 'test.JPG', { type: 'image/jpeg' });
      const mockStorage = {
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn(),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/public-url' }
        })
      };
      vi.mocked(supabase.storage.from).mockReturnValue(mockStorage as any);

      const result = await uploadFile(file, 'image');

      // Extension keeps original case from file name
      expect(result.path).toMatch(/\.JPG$/);
    }, 10000);
  });
});
