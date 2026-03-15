// ============================================
// 服务器 API 调用服务
// ============================================

import type {
  CreatePairingResponse,
  PairingStatusResponse,
  ClaimPairingResponse,
  SendToPhoneRequest,
  SendToPhoneResponse,
  GetMessagesResponse,
  UploadResponse
} from './types.js';

export class TrixNativeAPI {
  private baseUrl: string;

  constructor(serverUrl: string) {
    this.baseUrl = serverUrl.replace(/\/$/, '');
  }

  /**
   * 生成配对码
   */
  async createPairing(): Promise<CreatePairingResponse> {
    const response = await fetch(`${this.baseUrl}/api/pairings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to create pairing: ${response.statusText}`);
    }

    return response.json() as Promise<CreatePairingResponse>;
  }

  /**
   * 查询配对状态
   */
  async getPairingStatus(code: string): Promise<PairingStatusResponse> {
    const response = await fetch(`${this.baseUrl}/api/pairings/${code}`);

    if (!response.ok) {
      throw new Error(`Failed to get pairing status: ${response.statusText}`);
    }

    return response.json() as Promise<PairingStatusResponse>;
  }

  /**
   * 认领配对
   */
  async claimPairing(
    code: string,
    deviceId: string,
    deviceName: string
  ): Promise<ClaimPairingResponse> {
    const response = await fetch(`${this.baseUrl}/api/pairings/${code}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        deviceId,
        deviceName
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' })) as { message: string };
      throw new Error(error.message || `Failed to claim pairing: ${response.statusText}`);
    }

    return response.json() as Promise<ClaimPairingResponse>;
  }

  /**
   * 发送消息到手机
   */
  async sendToPhone(
    request: SendToPhoneRequest,
    token: string
  ): Promise<SendToPhoneResponse> {
    const response = await fetch(`${this.baseUrl}/api/messages/from-plugin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Plugin-Token': token
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    return response.json() as Promise<SendToPhoneResponse>;
  }

  /**
   * 获取手机消息
   */
  async getMessages(
    conversationId: string,
    token: string,
    lastMessageId?: string
  ): Promise<GetMessagesResponse> {
    const url = new URL(`${this.baseUrl}/api/messages/to-plugin`);
    url.searchParams.set('conversationId', conversationId);
    if (lastMessageId) {
      url.searchParams.set('lastMessageId', lastMessageId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'X-Plugin-Token': token
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.statusText}`);
    }

    return response.json() as Promise<GetMessagesResponse>;
  }

  /**
   * 上传文件
   */
  async uploadFile(
    file: Blob,
    fileName: string,
    type: 'image' | 'audio' | 'video' | 'file',
    token: string
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('type', type);

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Plugin-Token': token
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    return response.json() as Promise<UploadResponse>;
  }

  /**
   * 检查设备状态
   */
  async checkDeviceStatus(deviceId: string, token: string): Promise<boolean> {
    const response = await fetch(
      `${this.baseUrl}/api/devices/${deviceId}/status`,
      {
        headers: {
          'X-Plugin-Token': token
        }
      }
    );

    return response.ok;
  }

  /**
   * 验证 token 是否有效
   */
  async validateToken(token: string): Promise<{ valid: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/auth/validate`, {
      headers: {
        'X-Plugin-Token': token
      }
    });

    if (!response.ok) {
      return { valid: false };
    }

    return response.json() as Promise<{ valid: boolean }>;
  }

  /**
   * 刷新 token
   */
  async refreshToken(refreshToken: string): Promise<{ pluginToken: string; refreshToken: string }> {
    const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    return response.json() as Promise<{ pluginToken: string; refreshToken: string }>;
  }

  /**
   * 获取服务器 URL（供外部使用）
   */
  getServerUrl(): string {
    return this.baseUrl;
  }
}
