const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 最大文件大小限制: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;
// 允许的目录列表
const ALLOWED_DIRECTORIES = [
  path.resolve(__dirname, '../../uploads'),
  path.resolve(__dirname, '../../../uploads'),
  path.resolve(__dirname, '../../temp'),
  path.resolve(__dirname, '../../../temp'),
];

/**
 * ArtifactService - 处理 TRIX 生成的 artifact（文件产物）自动上传
 */
class ArtifactService {
  constructor(ossService) {
    this.ossService = ossService;
  }

  /**
   * 验证文件路径是否在允许的目录内（防止 path traversal）
   */
  isPathAllowed(filePath) {
    try {
      const resolvedPath = path.resolve(filePath);
      return ALLOWED_DIRECTORIES.some(allowedDir => resolvedPath.startsWith(allowedDir));
    } catch {
      return false;
    }
  }

  /**
   * 验证文件大小是否超限
   */
  isSizeValid(buffer) {
    return buffer.length <= MAX_FILE_SIZE;
  }

  /**
   * 处理单个 artifact（文件产物）
   * @param {Object} artifact - artifact 对象
   * @param {string} [artifact.filePath] - 本地文件路径
   * @param {Buffer} [artifact.buffer] - 文件 buffer
   * @param {string} [artifact.fileName] - 文件名
   * @param {string} [artifact.mimeType] - MIME 类型
   * @returns {Promise<Object|null>} - 上传后的结果，包含 url 和 metadata
   */
  async processArtifact(artifact) {
    if (!this.ossService) {
      console.warn('[ArtifactService] OSS service not available');
      return null;
    }

    try {
      let buffer;
      let fileName;
      let mimeType;

      // 从不同格式提取文件数据
      if (artifact.buffer) {
        buffer = artifact.buffer;
        fileName = artifact.fileName || artifact.name || `artifact_${uuidv4()}`;
        mimeType = artifact.mimeType || artifact.mime_type || this.guessMimeType(fileName);
      } else if (artifact.filePath) {
        // 读取本地文件 - 防止 path traversal
        if (!this.isPathAllowed(artifact.filePath)) {
          console.error('[ArtifactService] Path traversal attempt detected:', artifact.filePath);
          return null;
        }
        if (!fs.existsSync(artifact.filePath)) {
          console.error('[ArtifactService] File not found:', artifact.filePath);
          return null;
        }
        buffer = fs.readFileSync(artifact.filePath);
        fileName = path.basename(artifact.filePath);
        mimeType = artifact.mimeType || this.guessMimeType(fileName);
      } else if (artifact.base64) {
        // 处理 base64 编码的文件
        const matches = artifact.base64.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
          fileName = artifact.fileName || artifact.name || `artifact_${uuidv4()}.${this.getExtFromMime(mimeType)}`;
        } else {
          // 纯 base64 无 data URI
          buffer = Buffer.from(artifact.base64, 'base64');
          fileName = artifact.fileName || artifact.name || `artifact_${uuidv4()}`;
          mimeType = artifact.mimeType || this.guessMimeType(fileName);
        }
      } else {
        console.warn('[ArtifactService] No valid artifact data provided');
        return null;
      }

      // 验证文件大小
      if (!this.isSizeValid(buffer)) {
        console.error('[ArtifactService] File too large:', buffer.length, 'max:', MAX_FILE_SIZE);
        return null;
      }

      // 上传到 OSS
      const result = await this.ossService.uploadFile(buffer, fileName, mimeType);

      if (result) {
        console.log('[ArtifactService] Artifact uploaded:', result.objectKey);
        return {
          url: result.url,
          objectKey: result.objectKey,
          fileName: fileName,
          mimeType: mimeType,
          size: buffer.length,
          uploadedAt: new Date().toISOString()
        };
      }

      return null;
    } catch (err) {
      console.error('[ArtifactService] Process artifact failed:', err);
      return null;
    }
  }

  /**
   * 处理 AI 返回的 artifacts 数组
   * @param {Array} artifacts - artifact 数组
   * @returns {Promise<Array>} - 上传后的结果数组
   */
  async processArtifacts(artifacts) {
    if (!Array.isArray(artifacts) || artifacts.length === 0) {
      return [];
    }

    const results = [];
    for (const artifact of artifacts) {
      const uploaded = await this.processArtifact(artifact);
      if (uploaded) {
        results.push(uploaded);
      }
    }
    return results;
  }

  /**
   * 从消息数据中提取并处理 artifact
   * @param {Object} data - 消息数据
   * @returns {Promise<Object|null>} - 处理后的 artifact 信息
   */
  async processMessageArtifact(data) {
    // 支持多种 artifact 字段名
    const artifact = data.artifact ?? data.artifacts ??
                    data.fileArtifact ?? data.file_artifact ?? null;

    if (!artifact) {
      return null;
    }

    // 如果是数组，只处理第一个
    if (Array.isArray(artifact)) {
      if (artifact.length === 0) return null;
      return await this.processArtifact(artifact[0]);
    }

    return await this.processArtifact(artifact);
  }

  /**
   * 根据文件名猜测 MIME 类型
   */
  guessMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * 从 MIME 类型获取扩展名
   */
  getExtFromMime(mimeType) {
    const mimeToExt = {
      'application/pdf': 'pdf',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'application/json': 'json',
      'text/plain': 'txt'
    };
    return mimeToExt[mimeType] || 'bin';
  }
}

module.exports = ArtifactService;
