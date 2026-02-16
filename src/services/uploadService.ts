/**
 * 📎 Upload Service - Multi-Modal File Uploads
 * ============================================
 * Handles image and video uploads to Supabase Storage
 * with validation, compression, thumbnail generation, metadata extraction, and error handling
 */

import { supabase } from '../config/supabase';
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

export const MAX_FILE_SIZE = {
  image: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024  // 50MB
};

// ============================================
// 📝 Type Definitions
// ============================================

export interface UploadResult {
  uri: string;          // Public URL
  path: string;         // Storage path
  type: string;         // MIME type
  size: number;         // File size in bytes
  category: 'image' | 'video';
  metadata?: UploadMetadata;
}

export interface UploadMetadata {
  width?: number;       // Image/video width
  height?: number;      // Image/video height
  duration?: number;    // Video duration in seconds
  thumbnail?: string;   // Thumbnail URI (future)
}

export interface UploadError {
  message: string;
  code?: string;
}

// ============================================
// ✅ Validation
// ============================================

function validateFile(file: File, category: 'image' | 'video'): UploadError | null {
  const acceptedTypes = category === 'image' ? ACCEPTED_IMAGE_TYPES : ACCEPTED_VIDEO_TYPES;
  const maxSize = MAX_FILE_SIZE[category];

  // Check file type
  if (!acceptedTypes.includes(file.type)) {
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
        console.warn('Failed to generate thumbnail');
        resolve(null);
      };

      img.src = url;
    } catch (error) {
      console.warn('Error generating thumbnail:', error);
      resolve(null);
    }
  });
}

async function extractMetadata(file: File, category: 'image' | 'video'): Promise<UploadMetadata> {
  const metadata: UploadMetadata = {};

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
        console.warn('Failed to extract image metadata');
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
        console.warn('Failed to extract video metadata');
        URL.revokeObjectURL(url);
        resolve(metadata);
      };

      video.src = url;
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
 * @param category - 'image' or 'video'
 * @returns UploadResult with public URL and metadata
 * @throws Error if upload fails
 */
export async function uploadFile(
  file: File,
  category: 'image' | 'video'
): Promise<UploadResult> {
  const perfStart = performance.now();
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
      const compressStart = performance.now();

      try {
        compressedFile = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS);
      } catch (compressError) {
        console.warn('[Upload] Compression failed, using original:', compressError);
        compressedFile = file;
      }
    }

    // 4. Generate unique filename
    const fileExt = compressedFile.name.split('.').pop() || 'bin';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${user.id}/${category}s/${fileName}`;

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
        console.warn('[Upload] Thumbnail generation failed:', thumbError);
      }
    }

    // 7. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
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
      console.error('[Upload] Upload error:', uploadError);
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

  } catch (error: any) {
    console.error('[Upload] Error:', error);
    throw error;
  }
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
      console.error('[Delete] Error:', error);
      throw new Error(`删除失败: ${error.message}`);
    }
  } catch (error: any) {
    console.error('[Delete] Error:', error);
    throw error;
  }
}

// ============================================
// 🔄 Helper Functions
// ============================================

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): 'image' | 'video' | null {
  if (ACCEPTED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (ACCEPTED_VIDEO_TYPES.includes(mimeType)) return 'video';
  return null;
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
  const category = getFileCategory(file.type);
  if (!category) return false;

  const maxSize = MAX_FILE_SIZE[category];
  return file.size <= maxSize;
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
 *   console.log('Image uploaded:', result.uri);
 *   // Use result.uri to save to database
 * } catch (error) {
 *   console.error('Upload failed:', error.message);
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
 *   alert('请选择图片或视频文件');
 *   return;
 * }
 *
 * if (!isValidFile(file)) {
 *   alert('文件过大或格式不支持');
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
 *   console.log('File deleted');
 * } catch (error) {
 *   console.error('Delete failed:', error.message);
 * }
 * ```
 */

export default uploadFile;
