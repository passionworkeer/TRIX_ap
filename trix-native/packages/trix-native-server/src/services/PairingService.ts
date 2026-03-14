// ============================================
// 配对服务
// ============================================

import QRCode from 'qrcode';
import { store } from '../services/MemoryStore.js';
import type { Pairing, PairingCreateResponse, PairingStatusResponse, PairingClaimResponse } from '../types.js';
import {
  generatePairingCode,
  generateId,
  generateToken,
  generateDeviceId,
  addMinutes,
  isExpired
} from '../utils/helpers.js';

const DEFAULT_PAIRING_EXPIRY = 5; // 5分钟

export class PairingService {
  constructor(
    private config: {
      serverUrl: string;
      jwtSecret: string;
      jwtExpiresIn: string;
      pairingCodeLength?: number;
      pairingExpiresIn?: number;
    }
  ) {}

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

    store.pairings.set(code, pairing);

    // 生成 QR 码
    const qrData = JSON.stringify({
      type: 'trix-native',
      code,
      server: this.config.serverUrl
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
    const pairing = store.pairings.get(code.toUpperCase());

    if (!pairing) {
      throw new Error('PAIRING_NOT_FOUND');
    }

    // 检查是否过期
    if (pairing.status !== 'paired' && isExpired(pairing.expiresAt)) {
      pairing.status = 'expired';
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
    const pairing = store.pairings.get(code.toUpperCase());

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
      pairing.status = 'expired';
      throw new Error('PAIRING_EXPIRED');
    }

    // 生成 token
    const deviceIdFinal = generateDeviceId();
    const pluginToken = generateToken('plugin', this.config.jwtSecret, this.config.jwtExpiresIn);
    const refreshToken = generateToken('refresh', this.config.jwtSecret, '30d');

    // 更新配对状态
    pairing.status = 'paired';
    pairing.deviceId = deviceIdFinal;
    pairing.deviceName = deviceName;
    pairing.devicePublicKey = publicKey;
    pairing.pluginToken = pluginToken;
    pairing.refreshToken = refreshToken;
    pairing.pairedAt = new Date();

    // 存储设备信息
    store.devices.set(deviceIdFinal, {
      id: deviceIdFinal,
      name: deviceName,
      type: 'phone',
      status: 'active',
      lastSeen: new Date(),
      createdAt: new Date()
    });

    console.log(`[PairingService] Pairing claimed: ${code} -> device: ${deviceIdFinal}`);

    return {
      success: true,
      deviceId: deviceIdFinal,
      pluginToken,
      refreshToken,
      serverUrl: this.config.serverUrl,
      expiresIn: 365 * 24 * 60 * 60 // 1年
    };
  }

  /**
   * 获取配对 (通过 code)
   */
  getPairingByCode(code: string): Pairing | undefined {
    return store.pairings.get(code.toUpperCase());
  }

  /**
   * 获取配对 (通过 deviceId)
   */
  getPairingByDeviceId(deviceId: string): Pairing | undefined {
    for (const pairing of store.pairings.values()) {
      if (pairing.deviceId === deviceId) {
        return pairing;
      }
    }
    return undefined;
  }

  /**
   * 更新配对状态
   */
  updatePairingStatus(code: string, status: Pairing['status']): void {
    const pairing = store.pairings.get(code.toUpperCase());
    if (pairing) {
      pairing.status = status;
      if (status === 'paired') {
        pairing.pairedAt = new Date();
      }
    }
  }
}
