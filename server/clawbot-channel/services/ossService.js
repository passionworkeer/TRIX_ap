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

class OSSService {
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
