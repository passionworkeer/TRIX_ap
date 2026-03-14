// ============================================
// 凭证管理服务
// ============================================

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { PluginCredentials } from './types.js';

const CREDENTIALS_DIR = path.join(os.homedir(), '.openclaw', 'credentials');
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'trixNative-creds.json');

/**
 * 确保凭证目录存在
 */
function ensureCredentialsDir(): void {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  }
}

/**
 * 保存凭证
 */
export async function saveCredentials(credentials: PluginCredentials): Promise<void> {
  ensureCredentialsDir();

  const data = JSON.stringify(credentials, null, 2);
  fs.writeFileSync(CREDENTIALS_FILE, data, 'utf-8');

  console.log(`[Credentials] Saved credentials to ${CREDENTIALS_FILE}`);
}

/**
 * 加载凭证
 */
export async function loadCredentials(): Promise<PluginCredentials | null> {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return null;
  }

  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
    const credentials = JSON.parse(data) as PluginCredentials;

    // 检查是否过期
    if (new Date(credentials.expiresAt) < new Date()) {
      console.log('[Credentials] Credentials expired');
      await deleteCredentials();
      return null;
    }

    return credentials;
  } catch (error) {
    console.error('[Credentials] Failed to load credentials:', error);
    return null;
  }
}

/**
 * 删除凭证
 */
export async function deleteCredentials(): Promise<void> {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
    console.log('[Credentials] Deleted credentials');
  }
}

/**
 * 检查是否有有效凭证
 */
export async function hasCredentials(): Promise<boolean> {
  const credentials = await loadCredentials();
  return credentials !== null;
}
