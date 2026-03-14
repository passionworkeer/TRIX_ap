// ============================================
// 配对流程
// ============================================

import { TrixNativeAPI } from './api.js';
import { saveCredentials, deleteCredentials } from './credentials.js';
import type { PluginCredentials } from './types.js';
import { generateId } from './utils.js';

const DEFAULT_PAIRING_TIMEOUT = 5 * 60 * 1000; // 5分钟
const POLL_INTERVAL = 3000; // 3秒轮询一次

/**
 * 配对流程
 */
export async function performPairing(
  api: TrixNativeAPI,
  deviceName: string,
  onStatusUpdate?: (status: string) => void
): Promise<PluginCredentials> {
  console.log('[Pairing] Starting pairing process...');

  // 1. 生成本地设备ID
  const deviceId = `device_${generateId().slice(0, 16)}`;

  // 2. 请求服务器生成配对码
  onStatusUpdate?.('creating');

  const pairing = await api.createPairing();

  console.log(`[Pairing] Created pairing code: ${pairing.code}`);
  console.log(`[Pairing] QR Code available, waiting for phone...`);

  // 3. 轮询等待配对确认
  const startTime = Date.now();

  while (Date.now() - startTime < DEFAULT_PAIRING_TIMEOUT) {
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

    try {
      const status = await api.getPairingStatus(pairing.code);

      console.log(`[Pairing] Status: ${status.status}`);

      if (status.status === 'paired' && status.deviceId) {
        // 4. 配对成功，获取 token
        const claim = await api.claimPairing(pairing.code, deviceId, deviceName);

        console.log(`[Pairing] Pairing successful!`);

        // 5. 保存凭证
        const credentials: PluginCredentials = {
          version: '1.0',
          accountId: 'default',
          serverUrl: api.serverUrl,
          deviceId: claim.deviceId,
          pluginToken: claim.pluginToken,
          refreshToken: claim.refreshToken,
          pairedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + claim.expiresIn * 1000).toISOString()
        };

        await saveCredentials(credentials);

        console.log('[Pairing] Credentials saved');

        return credentials;
      }

      if (status.status === 'expired') {
        throw new Error('配对码已过期，请重新配对');
      }

      onStatusUpdate?.('waiting');
    } catch (error) {
      console.error('[Pairing] Error checking status:', error);
      throw error;
    }
  }

  // 超时
  throw new Error('配对超时，请重新配对');
}

/**
 * 恢复连接
 */
export async function resumeConnection(
  api: TrixNativeAPI,
  credentials: PluginCredentials
): Promise<boolean> {
  console.log('[Resume] Attempting to resume connection...');

  try {
    const isValid = await api.checkDeviceStatus(credentials.deviceId, credentials.pluginToken);

    if (isValid) {
      console.log('[Resume] Connection resumed successfully');
      return true;
    }

    console.log('[Resume] Device not found or inactive');
    return false;
  } catch (error) {
    console.error('[Resume] Failed to resume connection:', error);
    return false;
  }
}

/**
 * 断开连接
 */
export async function disconnect(): Promise<void> {
  await deleteCredentials();
  console.log('[Disconnect] Disconnected and credentials removed');
}
