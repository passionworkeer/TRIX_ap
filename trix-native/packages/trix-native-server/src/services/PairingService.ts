// ============================================
// 配对服务
// ============================================

import QRCode from 'qrcode';
import { pairingDB, deviceDB, initDatabase } from './SQLiteStore.js';
import type { Pairing, PairingCreateResponse, PairingStatusResponse, PairingClaimResponse } from '../types.js';
import {
  generatePairingCode,
  generateId,
  generateToken,
  generateDeviceId,
  addMinutes,
  isExpired
} from '../utils/helpers.js';

const DEFAULT_PAIRING_EXPIRY = 30; // 30分钟

export class PairingService {
  constructor(
    private config: {
      serverUrl: string;
      jwtSecret: string;
      jwtExpiresIn: string;
      pairingCodeLength?: number;
      pairingExpiresIn?: number;
    }
  ) {
    // 初始化数据库
    initDatabase();
  }

  /**
   * 创建新的配对
   */
  async createPairing(devicePublicKey?: string, label?: string): Promise<PairingCreateResponse> {
    const code = generatePairingCode(this.config.pairingCodeLength || 6);
    const now = new Date();
    const expiresAt = addMinutes(now, this.config.pairingExpiresIn || DEFAULT_PAIRING_EXPIRY);

    const pairing: Pairing = {
      id: generateId('pairing'),
      code,
      status: 'waiting',
      devicePublicKey,
      createdAt: now,
      expiresAt
    };

    // 保存到数据库
    pairingDB.create(pairing);

    // 生成 QR 码
    const qrData = JSON.stringify({
      type: 'trix-native',
      code,
      serverUrl: this.config.serverUrl
    });

    const qrDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    console.log(`[PairingService] Created pairing: ${code}`);

    return {
      success: true,
      code,
      qrDataUrl,
      expiresIn: (this.config.pairingExpiresIn || DEFAULT_PAIRING_EXPIRY) * 60,
      createdAt: now.toISOString()
    };
  }

  /**
   * 获取配对状态
   */
  async getPairingStatus(code: string): Promise<PairingStatusResponse> {
    const pairing = pairingDB.findByCode(code);

    if (!pairing) {
      throw new Error('PAIRING_NOT_FOUND');
    }

    // 检查是否过期
    if (pairing.status !== 'paired' && isExpired(pairing.expiresAt)) {
      pairing.status = 'expired';
      pairingDB.update(code, { status: 'expired' });
    }

    return {
      success: true,
      code: pairing.code,
      status: pairing.status,
      deviceId: pairing.deviceId,
      createdAt: pairing.createdAt.toISOString(),
      pairedAt: pairing.pairedAt?.toISOString()
    };
  }

  /**
   * 认领配对 (手机端调用)
   */
  async claimPairing(
    code: string,
    deviceId: string,
    deviceName: string,
    publicKey?: string
  ): Promise<PairingClaimResponse> {
    const pairing = pairingDB.findByCode(code);

    if (!pairing) {
      throw new Error('PAIRING_NOT_FOUND');
    }

    if (pairing.status === 'paired') {
      throw new Error('PAIRING_ALREADY_USED');
    }

    if (pairing.status !== 'waiting' && pairing.status !== 'phone_connected') {
      throw new Error('PAIRING_EXPIRED');
    }

    if (isExpired(pairing.expiresAt)) {
      pairingDB.update(code, { status: 'expired' });
      throw new Error('PAIRING_EXPIRED');
    }

    // 生成 token
    const deviceIdFinal = generateDeviceId();
    const pluginToken = generateToken('plugin', this.config.jwtSecret, this.config.jwtExpiresIn);
    const refreshToken = generateToken('refresh', this.config.jwtSecret, '30d');

    const now = new Date();

    // 更新配对状态
    pairingDB.update(code, {
      status: 'paired',
      device_id: deviceIdFinal,
      device_name: deviceName,
      device_public_key: publicKey,
      plugin_token: pluginToken,
      refresh_token: refreshToken,
      paired_at: now.toISOString()
    });

    // 存储设备信息
    deviceDB.create({
      id: deviceIdFinal,
      name: deviceName,
      type: 'phone',
      status: 'active',
      lastSeen: now,
      createdAt: now
    });

    console.log(`[PairingService] Pairing claimed: ${code} -> device: ${deviceIdFinal}`);

    // 构建 WebSocket URL
    const wsUrl = this.config.serverUrl.replace(/^http/, 'ws') + '/ws';

    return {
      success: true,
      conversationId: deviceIdFinal,
      clientToken: pluginToken,
      websocketUrl: wsUrl,
      serverUrl: this.config.serverUrl,
      pairing: {
        code: code
      },
      agentOnline: true,
      deviceId: deviceIdFinal,
      expiresIn: 365 * 24 * 60 * 60 // 1年
    };
  }

  /**
   * 获取配对 (通过 code)
   */
  getPairingByCode(code: string): Pairing | undefined {
    const result = pairingDB.findByCode(code);
    return result ?? undefined;
  }

  /**
   * 获取配对 (通过 deviceId)
   */
  getPairingByDeviceId(deviceId: string): Pairing | undefined {
    const result = pairingDB.findByDeviceId(deviceId);
    return result ?? undefined;
  }

  /**
   * 更新配对状态
   */
  updatePairingStatus(code: string, status: Pairing['status']): void {
    pairingDB.update(code, { status });
  }

  /**
   * 验证 token
   */
  validateToken(token: string): boolean {
    const pairings = pairingDB.findAll() as any[];
    return pairings.some(p => p.plugin_token === token);
  }

  /**
   * 刷新 token
   */
  refreshToken(refreshToken: string): { pluginToken: string; refreshToken: string } | null {
    const pairings = pairingDB.findAll() as any[];
    const pairing = pairings.find(p => p.refresh_token === refreshToken);

    if (!pairing) {
      return null;
    }

    const newPluginToken = generateToken('plugin', this.config.jwtSecret, this.config.jwtExpiresIn);
    const newRefreshToken = generateToken('refresh', this.config.jwtSecret, '30d');

    pairingDB.update(pairing.code, {
      plugin_token: newPluginToken,
      refresh_token: newRefreshToken
    });

    return {
      pluginToken: newPluginToken,
      refreshToken: newRefreshToken
    };
  }
}
