let OSS = null;
let client = null;

// 检查是否配置了 OSS
if (process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET && process.env.OSS_BUCKET) {
  OSS = require('ali-oss');
  client = new OSS({
    region: process.env.OSS_REGION,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET
  });
  console.log('[OSS] OSS client initialized');
} else {
  console.log('[OSS] OSS not configured, file upload disabled');
}

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class OSSService {
  // 上传文件到OSS
  async uploadFile(buffer, originalName, contentType = 'application/octet-stream') {
    if (!client) {
      console.warn('[OSS] OSS client not initialized');
      return null;
    }

    try {
      // 生成唯一文件名
      const ext = path.extname(originalName);
      const filename = `${uuidv4()}${ext}`;
      const objectKey = `clawbot-channel/${Date.now()}/${filename}`;

      // 上传文件
      const result = await client.put(objectKey, buffer, {
        headers: {
          'Content-Type': contentType
        }
      });

      console.log('[OSS] File uploaded:', objectKey);
      return {
        url: result.url,
        objectKey: objectKey
      };
    } catch (err) {
      console.error('[OSS] Upload failed:', err);
      return null;
    }
  }

  // 上传Base64图片
  async uploadBase64(base64Data) {
    if (!client) {
      console.warn('[OSS] OSS client not initialized');
      return null;
    }

    try {
      // 解析Base64
      const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid base64 format');
      }

      const imageType = matches[1];
      const base64Buffer = Buffer.from(matches[2], 'base64');

      return await this.uploadFile(base64Buffer, `image.${imageType}`, `image/${imageType}`);
    } catch (err) {
      console.error('[OSS] Base64 upload failed:', err);
      return null;
    }
  }

  // 生成预签名URL（供Clawbot下载）
  async getSignedUrl(objectKey, expires = 3600) {
    if (!client) {
      console.warn('[OSS] OSS client not initialized');
      return null;
    }

    const url = client.signatureUrl(objectKey, {
      expires: expires,
      method: 'GET'
    });
    return url;
  }

  // 验证URL是否有效
  async validateObjectExists(objectKey) {
    if (!client) {
      console.warn('[OSS] OSS client not initialized');
      return false;
    }

    try {
      await client.head(objectKey);
      return true;
    } catch (err) {
      return false;
    }
  }
}

module.exports = new OSSService();
