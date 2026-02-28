/**
 * 阿里云 OSS 上传服务（浏览器版本）
 *
 * 使用简单的 PUT 上传方式
 * 注意：需要配置 OSS Bucket 的 CORS 规则
 */

import { getAliyunOssEnv } from '../utils/env';

interface OSSConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint: string;
}

class AliyunOSSService {
  private config: OSSConfig;

  constructor() {
    const env = getAliyunOssEnv();
    this.config = {
      region: env.region,
      bucket: env.bucket,
      accessKeyId: env.accessKeyId,
      accessKeySecret: env.accessKeySecret,
      endpoint: env.endpoint,
    };

    if (env.usingLegacyEndpointFallback) {
      console.warn('[OSS] VITE_OSS_ENDPOINT is deprecated; please migrate to VITE_ALIYUN_OSS_ENDPOINT');
    }
  }

  /**
   * 生成 HMAC-SHA1 签名（浏览器兼容）
   */
  private async generateSignature(
    method: string,
    resource: string,
    contentType: string,
    date: string
  ): Promise<string> {
    const stringToSign = `${method}\n\n${contentType}\n${date}\n${resource}`;

    // 将密钥转换为 ArrayBuffer
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.config.accessKeySecret);
    const messageData = encoder.encode(stringToSign);

    // 导入密钥
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    // 生成签名
    const signature = await crypto.subtle.sign('HMAC', key, messageData);

    // 转换为 Base64
    const signatureArray = Array.from(new Uint8Array(signature));
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray));

    return signatureBase64;
  }

  /**
   * 上传文件到 OSS
   */
  async uploadFile(
    file: File | Blob,
    filename?: string
  ): Promise<{ url: string; name: string }> {
    try {
      // 生成唯一文件名（使用安全的随机数生成器）
      const timestamp = Date.now();
      const randomArray = new Uint8Array(4);
      crypto.getRandomValues(randomArray);
      const random = Array.from(randomArray, b => b.toString(16).padStart(2, '0')).join('');
      const extension = file.type.split('/')[1] || 'jpg';
      const objectName = filename || `trix-uploads/${timestamp}_${random}.${extension}`;

      // 构建资源路径
      const resource = `/${this.config.bucket}/${objectName}`;

      // 生成日期（RFC 1123 格式）
      const date = new Date().toUTCString();

      // 生成签名
      const signature = await this.generateSignature('PUT', resource, file.type, date);

      // 构建 URL
      const url = `https://${this.config.bucket}.${this.config.endpoint}/${objectName}`;

      // 发起 PUT 请求
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'Date': date,
          'Authorization': `OSS ${this.config.accessKeyId}:${signature}`,
        },
        body: file,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[OSS] 上传失败:', errorText);
        throw new Error(`上传失败: ${response.status} ${response.statusText}`);
      }

      return {
        url,
        name: objectName,
      };
    } catch (error) {
      console.error('[OSS] 上传错误:', error);
      throw error;
    }
  }

  /**
   * 上传图片
   */
  async uploadImage(file: File | Blob): Promise<string> {
    const result = await this.uploadFile(file);
    return result.url;
  }

  /**
   * 上传视频
   */
  async uploadVideo(file: File | Blob): Promise<string> {
    const result = await this.uploadFile(file);
    return result.url;
  }

  /**
   * 批量上传
   */
  async uploadMultiple(files: File[]): Promise<string[]> {
    const uploadPromises = files.map(file => this.uploadFile(file));
    const results = await Promise.all(uploadPromises);
    return results.map(r => r.url);
  }

  /**
   * 获取文件访问 URL
   */
  getFileUrl(objectName: string): string {
    return `https://${this.config.bucket}.${this.config.endpoint}/${objectName}`;
  }
}

// 导出单例实例
export const ossService = new AliyunOSSService();
export default ossService;
