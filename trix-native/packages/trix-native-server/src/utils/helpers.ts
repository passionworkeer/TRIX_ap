// ============================================
// 工具函数
// ============================================

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// -------------------- 配对码生成 --------------------

export function generatePairingCode(length: number = 6, chars?: string): string {
  const defaultChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆字符
  const availableChars = chars || defaultChars;
  let code = '';

  for (let i = 0; i < length; i++) {
    code += availableChars[Math.floor(Math.random() * availableChars.length)];
  }

  return code;
}

// -------------------- ID生成 --------------------

export function generateId(prefix: string = 'msg'): string {
  return `${prefix}_${Date.now()}_${uuidv4().slice(0, 8)}`;
}

export function generateDeviceId(): string {
  return `device_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

// -------------------- Token生成 --------------------

export function generateToken(type: 'plugin' | 'refresh', secret: string, expiresIn: string): string {
  const payload = {
    type,
    iat: Date.now()
  };

  return jwt.sign(payload, secret, { expiresIn } as any);
}

export function verifyToken(token: string, secret: string): jwt.JwtPayload | null {
  try {
    return jwt.verify(token, secret) as jwt.JwtPayload;
  } catch {
    return null;
  }
}

// -------------------- 加密 --------------------

export function encrypt(data: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const keyBuffer = crypto.scryptSync(key, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedData: string, key: string): string {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const keyBuffer = crypto.scryptSync(key, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// -------------------- 文件名处理 --------------------

export function generateFileName(originalName: string): string {
  const ext = originalName.split('.').pop() || 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}_${random}.${ext}`;
}

export function getMimeTypeFromExt(ext: string): string {
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'json': 'application/json'
  };

  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

// -------------------- 日期处理 --------------------

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function isExpired(date: Date): boolean {
  return date.getTime() < Date.now();
}

export function toISOString(date?: Date): string {
  return (date || new Date()).toISOString();
}

// -------------------- 验证 --------------------

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isValidMimeType(mimeType: string, allowed: string[]): boolean {
  return allowed.some(type => {
    if (type.endsWith('/*')) {
      return mimeType.startsWith(type.slice(0, -1));
    }
    return mimeType === type;
  });
}

// -------------------- Sleep --------------------

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
