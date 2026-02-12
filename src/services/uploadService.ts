/**
 * 📎 Upload Service - Multi-Modal File Uploads
 * ============================================
 * Handles image and video uploads to Supabase Storage
 * with validation, metadata extraction, and error handling
 */

import { supabase } from '../config/supabase';

// ============================================
// 🔧 Configuration
// ============================================

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
  try {
    console.log('📤 [Upload] Starting upload:', {
      fileName: file.name,
      fileSize: (file.size / 1024 / 1024).toFixed(2) + 'MB',
      fileType: file.type,
      category
    });

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

    // 3. Generate unique filename
    const fileExt = file.name.split('.').pop() || 'bin';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${user.id}/${category}s/${fileName}`;

    console.log('📤 [Upload] Upload path:', filePath);

    // 4. Extract metadata
    const metadata = await extractMetadata(file, category);
    console.log('📊 [Upload] Extracted metadata:', metadata);

    // 5. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat_attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
        metadata: {
          originalName: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString()
        }
      });

    if (uploadError) {
      console.error('❌ [Upload] Upload error:', uploadError);
      throw new Error(`上传失败: ${uploadError.message}`);
    }

    console.log('✅ [Upload] Upload successful:', uploadData);

    // 6. Get public URL
    const { data: urlData } = supabase.storage
      .from('chat_attachments')
      .getPublicUrl(filePath);

    const result: UploadResult = {
      uri: urlData.publicUrl,
      path: filePath,
      type: file.type,
      size: file.size,
      category,
      metadata
    };

    console.log('✅ [Upload] Complete:', {
      uri: result.uri,
      size: (result.size / 1024).toFixed(2) + 'KB'
    });

    return result;

  } catch (error: any) {
    console.error('❌ [Upload] Error:', error);
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
    console.log('🗑️ [Delete] Deleting file:', path);

    const { error } = await supabase.storage
      .from('chat_attachments')
      .remove([path]);

    if (error) {
      console.error('❌ [Delete] Error:', error);
      throw new Error(`删除失败: ${error.message}`);
    }

    console.log('✅ [Delete] File deleted successfully');
  } catch (error: any) {
    console.error('❌ [Delete] Error:', error);
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
