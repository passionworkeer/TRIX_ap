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
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
  }

  /**
   * 生成配对码
   */
  async createPairing(): Promise<CreatePairingResponse> {
    const response = await fetch(`${this.serverUrl}/api/pairings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to create pairing: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 查询配对状态
   */
  async getPairingStatus(code: string): Promise<PairingStatusResponse> {
    const response = await fetch(`${this.serverUrl}/api/pairings/${code}`);

    if (!response.ok) {
      throw new Error(`Failed to get pairing status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 认领配对
   */
  async claimPairing(
    code: string,
    deviceId: string,
    deviceName: string
  ): Promise<ClaimPairingResponse> {
    const response = await fetch(`${this.serverUrl}/api/pairings/${code}/claim`, {
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
      const error = await response.json();
      throw new Error(error.message || `Failed to claim pairing: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 发送消息到手机
   */
  async sendToPhone(
    request: SendToPhoneRequest,
    token: string
  ): Promise<SendToPhoneResponse> {
    const response = await fetch(`${this.serverUrl}/api/messages/from-plugin`, {
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

    return response.json();
  }

  /**
   * 获取手机消息
   */
  async getMessages(
    conversationId: string,
    token: string,
    lastMessageId?: string
  ): Promise<GetMessagesResponse> {
    const url = new URL(`${this.serverUrl}/api/messages/to-plugin`);
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

    return response.json();
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

    const response = await fetch(`${this.serverUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'X-Plugin-Token': token
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 检查设备状态
   */
  async checkDeviceStatus(deviceId: string, token: string): Promise<boolean> {
    const response = await fetch(
      `${this.serverUrl}/api/devices/${deviceId}/status`,
      {
        headers: {
          'X-Plugin-Token': token
        }
      }
    );

    return response.ok;
  }
}
