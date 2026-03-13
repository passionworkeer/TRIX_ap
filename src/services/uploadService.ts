/**
 * 📎 Upload Service - Multi-Modal File Uploads
 * ============================================
 * Handles image and video uploads to Supabase Storage
 * with validation, compression, thumbnail generation, metadata extraction, and error handling
 */

import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import imageCompression from 'browser-image-compression';

// ============================================
// 🔧 Configuration
// ============================================

// Supabase Storage Bucket Name - DO NOT CHANGE
const BUCKET_NAME = 'TRIX';

// Image compression settings
export const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 1,              // Maximum file size: 1MB
  maxWidthOrHeight: 1920,    // Maximum dimension
  useWebWorker: true,        // Use web worker for better performance
  initialQuality: 0.85,      // Quality: 85%
  alwaysKeepResolution: false // Allow resolution reduction
};

// Thumbnail generation settings
export const THUMBNAIL_OPTIONS = {
  maxWidthOrHeight: 300,     // Thumbnail dimension
  quality: 0.7,              // Thumbnail quality: 70%
  format: 'image/jpeg'       // Thumbnail format
};

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

export const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo'  // .avi
];

export const ACCEPTED_AUDIO_TYPES = [
  'audio/webm',
  'audio/mp3',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav'
];

const BLOCKED_FILE_EXTENSIONS = [
  '.apk',
  '.app',
  '.bat',
  '.cmd',
  '.com',
  '.dmg',
  '.exe',
  '.hta',
  '.iso',
  '.jar',
  '.msi',
  '.ps1',
  '.scr',
  '.sh'
];

const BLOCKED_FILE_MIME_TYPES = [
  'application/java-archive',
  'application/vnd.microsoft.portable-executable',
  'application/x-apple-diskimage',
  'application/x-msdos-program',
  'application/x-msdownload',
  'application/x-sh',
  'application/x-shellscript'
];

export const MAX_FILE_SIZE = {
  image: 10 * 1024 * 1024,  // 10MB
  video: 50 * 1024 * 1024,  // 50MB
  audio: 10 * 1024 * 1024,  // 10MB
  file: 50 * 1024 * 1024    // 50MB
};

export type UploadCategory = 'image' | 'video' | 'audio' | 'file';

// ============================================
// 📝 Type Definitions
// ============================================

export interface UploadResult {
  uri: string;          // Public URL
  path: string;         // Storage path
  type: string;         // MIME type
  size: number;         // File size in bytes
  category: UploadCategory;
  metadata?: UploadMetadata;
}

export interface UploadMetadata {
  width?: number;       // Image/video width
  height?: number;      // Image/video height
  duration?: number;    // Video duration in seconds
  thumbnail?: string;   // Thumbnail URI (future)
  originalName?: string;
}

export interface UploadError {
  message: string;
  code?: string;
}

function hasBlockedExtension(fileName: string): boolean {
  const normalizedName = fileName.trim().toLowerCase();
  return BLOCKED_FILE_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));
}

function hasBlockedMimeType(mimeType: string): boolean {
  const normalizedMimeType = mimeType.trim().toLowerCase();
  if (!normalizedMimeType) {
    return false;
  }

  return BLOCKED_FILE_MIME_TYPES.includes(normalizedMimeType);
}

// ============================================
// ✅ Validation
// ============================================

function validateFile(file: File, category: UploadCategory): UploadError | null {
  const acceptedTypes = category === 'image'
    ? ACCEPTED_IMAGE_TYPES
    : category === 'video'
      ? ACCEPTED_VIDEO_TYPES
      : category === 'audio'
        ? ACCEPTED_AUDIO_TYPES
        : [];
  const maxSize = MAX_FILE_SIZE[category];

  // Check file type
  if (
    (category === 'file' && (hasBlockedExtension(file.name) || hasBlockedMimeType(file.type)))
    || (category !== 'file' && !acceptedTypes.includes(file.type))
  ) {
    return {
      message: `不支持的文件类型: ${file.type}`,
      code: 'INVALID_TYPE'
    };
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0);
    return {
      message: `文件过大，最大允许 ${maxSizeMB}MB`,
      code: 'FILE_TOO_LARGE'
    };
  }

  return null;
}

// ============================================
// 📊 Metadata Extraction
// ============================================

/**
 * Generate a thumbnail for an image
 */
async function generateThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }

        // Calculate thumbnail dimensions
        const maxDimension = THUMBNAIL_OPTIONS.maxWidthOrHeight;
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > height) {
          if (width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }

        canvas.width = Math.round(width);
        canvas.height = Math.round(height);

        // Draw thumbnail
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              resolve(URL.createObjectURL(blob));
            } else {
              resolve(null);
            }
          },
          THUMBNAIL_OPTIONS.format as'image/jpeg',
          THUMBNAIL_OPTIONS.quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        logger.upload.warn('Failed to generate thumbnail');
        resolve(null);
      };

      img.src = url;
    } catch (error) {
      logger.upload.warn('Error generating thumbnail:', error);
      resolve(null);
    }
  });
}

async function extractMetadata(file: File, category: UploadCategory): Promise<UploadMetadata> {
  const metadata: UploadMetadata = {
    originalName: file.name,
  };

  if (category === 'image') {
    // Extract image dimensions
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        metadata.width = img.naturalWidth;
        metadata.height = img.naturalHeight;
        URL.revokeObjectURL(url);
        resolve(metadata);
      };

      img.onerror = () => {
        logger.upload.warn('Failed to extract image metadata');
        URL.revokeObjectURL(url);
        resolve(metadata);
      };

      img.src = url;
    });
  }

  if (category === 'video') {
    // Extract video duration and dimensions
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        metadata.duration = video.duration;
        metadata.width = video.videoWidth;
        metadata.height = video.videoHeight;
        URL.revokeObjectURL(url);
        resolve(metadata);
      };

      video.onerror = () => {
        logger.upload.warn('Failed to extract video metadata');
        URL.revokeObjectURL(url);
        resolve(metadata);
      };

      video.src = url;
    });
  }

  // Audio metadata extraction
  if (category === 'audio') {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      const url = URL.createObjectURL(file);

      audio.onloadedmetadata = () => {
        metadata.duration = audio.duration;
        URL.revokeObjectURL(url);
        resolve(metadata);
      };

      audio.onerror = () => {
        logger.upload.warn('Failed to extract audio metadata');
        URL.revokeObjectURL(url);
        resolve(metadata);
      };

      audio.src = url;
    });
  }

  return metadata;
}

// ============================================
// 🚀 Upload Function
// ============================================

/**
 * Upload a file to Supabase Storage
 * @param file - File to upload
 * @param category - 'image', 'video', 'audio', or 'file'
 * @returns UploadResult with public URL and metadata
 * @throws Error if upload fails
 */
export async function uploadFile(
  file: File,
  category: UploadCategory
): Promise<UploadResult> {
  let compressedFile = file;

  try {
    // 1. Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('用户未登录，请先登录');
    }

    // 2. Validate file
    const validationError = validateFile(file, category);
    if (validationError) {
      throw new Error(validationError.message);
    }

    // 3. Compress image if needed
    if (category === 'image') {
      try {
        compressedFile = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
      } catch (compressError) {
        logger.upload.warn('[Upload] Compression failed, using original:', compressError);
        compressedFile = file;
      }
    }

    // 4. Generate unique filename
    const fileExt = compressedFile.name.split('.').pop() || 'bin';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const folderName = category === 'file' ? 'files' : `${category}s`;
    const filePath = `${user.id}/${folderName}/${fileName}`;

    // 5. Extract metadata
    const metadata = await extractMetadata(compressedFile, category);

    // 6. Generate thumbnail for images
    if (category === 'image' && !metadata.thumbnail) {
      try {
        const thumbnailUrl = await generateThumbnail(compressedFile);
        if (thumbnailUrl) {
          metadata.thumbnail = thumbnailUrl;
        }
      } catch (thumbError) {
        logger.upload.warn('[Upload] Thumbnail generation failed:', thumbError);
      }
    }

    // 7. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressedFile, {
        cacheControl: '31536000', // 1 year cache for better performance
        upsert: false,
        contentType: compressedFile.type,
        metadata: {
          originalName: compressedFile.name,
          size: compressedFile.size,
          uploadedAt: new Date().toISOString()
        }
      });

    if (uploadError) {
      logger.upload.error('[Upload] Upload error:', uploadError);
      throw new Error(`上传失败: ${uploadError.message}`);
    }

    // 8. Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    const result: UploadResult = {
      uri: urlData.publicUrl,
      path: filePath,
      type: compressedFile.type,
      size: compressedFile.size,
      category,
      metadata
    };

    return result;

  } catch (error: unknown) {
    logger.upload.error('[Upload] Error:', error);
    throw error;
  }
}

// ============================================
// 🎵 Audio Upload Function
// ============================================

/**
 * Upload an audio file to Supabase Storage
 * @param file - Audio file to upload
 * @returns UploadResult with public URL and metadata
 * @throws Error if upload fails
 */
export async function uploadAudio(file: File): Promise<UploadResult> {
  return uploadFile(file, 'audio');
}

// ============================================
// 🗑️ Delete Function
// ============================================

/**
 * Delete a file from Supabase Storage
 * @param path - Storage path of the file to delete
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      logger.upload.error('[Delete] Error:', error);
      throw new Error(`删除失败: ${error.message}`);
    }
  } catch (error: unknown) {
    logger.upload.error('[Delete] Error:', error);
    throw error;
  }
}

// ============================================
// 🔄 Helper Functions
// ============================================

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): Exclude<UploadCategory, 'file'> | null {
  if (ACCEPTED_IMAGE_TYPES.includes(mimeType as any)) return 'image';
  if (ACCEPTED_VIDEO_TYPES.includes(mimeType as any)) return 'video';
  if (ACCEPTED_AUDIO_TYPES.includes(mimeType as any)) return 'audio';
  return null;
}

/**
 * Resolve the upload category for a browser File.
 * Falls back to generic file uploads for non-media attachments.
 */
export function resolveFileCategory(file: Pick<File, 'type' | 'name'>): UploadCategory | null {
  const mediaCategory = getFileCategory(file.type || '');
  if (mediaCategory) {
    return mediaCategory;
  }

  const normalizedName = String(file.name || '').trim();
  if (!normalizedName) {
    return null;
  }

  return 'file';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

/**
 * Check if file is valid
 */
export function isValidFile(file: File): boolean {
  const category = resolveFileCategory(file);
  if (!category) return false;

  return validateFile(file, category) === null;
}

// ============================================
// 📝 Usage Examples
// ============================================

/**
 * Example 1: Upload an image
 * ```typescript
 * const file = event.target.files[0];
 * try {
 *   const result = await uploadFile(file, 'image');
 *   logger.upload.debug('Image uploaded:', result.uri);
 *   // Use result.uri to save to database
 * } catch (error) {
 *   logger.upload.error('Upload failed:', error.message);
 * }
 * ```
 */

/**
 * Example 2: Upload with validation
 * ```typescript
 * const file = event.target.files[0];
 * const category = getFileCategory(file.type);
 *
 * if (!category) {
 *   logger.upload.warn('请选择图片或视频文件');
 *   return;
 * }
 *
 * if (!isValidFile(file)) {
 *   logger.upload.warn('文件过大或格式不支持');
 *   return;
 * }
 *
 * const result = await uploadFile(file, category);
 * ```
 */

/**
 * Example 3: Delete a file
 * ```typescript
 * try {
 *   await deleteFile('user-id/images/uuid.jpg');
 *   logger.upload.debug('File deleted');
 * } catch (error) {
 *   logger.upload.error('Delete failed:', error.message);
 * }
 * ```
 */

export default uploadFile;
