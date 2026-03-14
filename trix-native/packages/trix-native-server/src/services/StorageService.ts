// ============================================
// 文件存储服务
// ============================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { UploadResponse } from '../types.js';
import { generateFileName, getMimeTypeFromExt, isValidMimeType } from '../utils/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StorageService {
  private uploadDir: string;
  private maxFileSize: number;
  private allowedMimeTypes: string[];

  constructor(
    uploadDir: string,
    maxFileSize: number = 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: string[] = [
      // 图片
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      // 音频
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      // 视频
      'video/mp4',
      'video/quicktime',
      // 文件
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/json'
    ]
  ) {
    this.uploadDir = uploadDir;
    this.maxFileSize = maxFileSize;
    this.allowedMimeTypes = allowedMimeTypes;

    // 确保上传目录存在
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      console.log(`[StorageService] Created upload directory: ${this.uploadDir}`);
    }
  }

  /**
   * 保存上传的文件
   */
  async saveFile(
    file: Express.Multer.File,
    type: 'image' | 'audio' | 'video' | 'file'
  ): Promise<UploadResponse> {
    // 验证文件大小
    if (file.size > this.maxFileSize) {
      throw new Error('FILE_TOO_LARGE');
    }

    // 验证文件类型
    if (!isValidMimeType(file.mimetype, this.allowedMimeTypes)) {
      throw new Error('UNSUPPORTED_FILE_TYPE');
    }

    // 生成文件名
    const ext = path.extname(file.originalname).slice(1) || 'bin';
    const fileName = generateFileName(file.originalname);
    const subDir = type === 'image' || type === 'audio' || type === 'video' ? type : 'file';

    // 创建子目录
    const targetDir = path.join(this.uploadDir, subDir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 保存文件
    const targetPath = path.join(targetDir, fileName);
    fs.writeFileSync(targetPath, file.buffer);

    // 构建 URL
    const url = `/attachments/${subDir}/${fileName}`;

    console.log(`[StorageService] Saved file: ${fileName} (${file.size} bytes)`);

    // 获取图片/视频尺寸
    let width: number | undefined;
    let height: number | undefined;
    let duration: number | undefined;

    if (type === 'image') {
      const dimensions = await this.getImageDimensions(targetPath);
      width = dimensions.width;
      height = dimensions.height;
    }

    return {
      success: true,
      url,
      mimeType: file.mimetype,
      size: file.size,
      width,
      height,
      duration
    };
  }

  /**
   * 获取图片尺寸 (简化版)
   * 生产环境建议使用 sharp 或 image-size
   */
  private async getImageDimensions(
    filePath: string
  ): Promise<{ width?: number; height?: number }> {
    // 这里简化处理，实际应使用专门的库获取图片尺寸
    // 暂时返回 undefined
    return {};
  }

  /**
   * 删除文件
   */
  deleteFile(urlPath: string): boolean {
    try {
      const filePath = path.join(this.uploadDir, urlPath.replace(/^\/attachments\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[StorageService] Deleted file: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[StorageService] Failed to delete file: ${urlPath}`, error);
      return false;
    }
  }

  /**
   * 获取文件路径
   */
  getFilePath(relativePath: string): string {
    return path.join(this.uploadDir, relativePath);
  }
}
