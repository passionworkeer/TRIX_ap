import { supabase } from '../config/supabase';
import { DeviceInfo } from 'react-native-device-info';

/**
 * Clawbot 扫码配对服务
 *
 * 功能说明：
 * 1. 生成配对请求
 * 2. 获取二维码内容
 * 3. 轮询配对状态
 * 4. 审批通过后使用 device_token 连接
 */

interface PairingRequest {
  requestId: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop';
  timestamp: number;
  status: 'pending' | 'approved' | 'expired' | 'denied' | 'cancelled';
}

interface PairingResponse {
  requestId: string;
  status: 'pending' | 'approved' | 'expired' | 'denied';
  deviceToken?: string;
  message?: string;
}

interface QRCodeData {
  gatewayUrl: string;
  pairingToken: string;
  gatewayId: string;
  expiresAt: string;
}

class ClawbotPairingService {
  private gatewayUrl: string;
  private authToken: string;
  private pollingInterval: NodeJS.Timeout | null = null;
  private currentRequestId: string | null = null;

  constructor() {
    // 从环境变量读取 Gateway 配置
    this.gatewayUrl = __DEV__
      ? 'ws://localhost:18789'
      : (import.meta.env.VITE_CLAWBOT_GATEWAY_URL || 'ws://192.168.1.100:18789');

    this.authToken = import.meta.env.VITE_CLAWBOT_GATEWAY_TOKEN || '';

    console.log('[ClawbotPairing] 初始化', {
      gatewayUrl: this.gatewayUrl,
      hasToken: !!this.authToken
    });
  }

  /**
   * 生成配对请求
   */
  async generatePairingRequest(deviceName?: string): Promise<PairingRequest> {
    // 生成唯一请求 ID
    const requestId = `trix-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    // 获取设备信息
    const deviceId = DeviceInfo.getUniqueId() || 'unknown-device';
    const defaultDeviceName = deviceName || `TRIX-${DeviceInfo.getSystemName()}`;

    const request: PairingRequest = {
      requestId,
      deviceName: defaultDeviceName,
      deviceType: 'mobile', // TRIX App 是移动端
      timestamp: Date.now(),
      status: 'pending'
    };

    try {
      // 存储到 Supabase 用于跨设备同步和 Gateway 读取
      const { error } = await supabase
        .from('pairing_requests')
        .insert([{
          id: requestId,
          device_id: deviceId,
          device_name: defaultDeviceName,
          device_type: 'mobile',
          status: 'pending',
          created_at: new Date().toISOString()
        }])
        .select();

      if (error) {
        console.error('[ClawbotPairing] 存储配对请求失败:', error);
        throw new Error('存储配对请求失败');
      }

      this.currentRequestId = requestId;
      console.log('[ClawbotPairing] 配对请求已生成:', requestId);

      return request;
    } catch (error) {
      console.error('[ClawbotPairing] 生成配对请求失败:', error);
      throw error;
    }
  }

  /**
   * 获取二维码内容（供 Gateway 生成二维码使用）
   */
  getQRCodeContent(): string {
    const qrData: QRCodeData = {
      gatewayUrl: this.gatewayUrl.replace('ws://', 'wss://'), // HTTPS 需要 wss
      pairingToken: this.authToken,
      gatewayId: 'trix-gateway-001',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 分钟后过期
    };

    return JSON.stringify(qrData);
  }

  /**
   * 轮询配对状态
   *
   * @param onStatusChange - 状态变化回调
   * @param intervalMs - 轮询间隔（毫秒）
   * @param maxAttempts - 最大尝试次数
   */
  async pollPairingStatus(
    requestId: string,
    onStatusChange: (response: PairingResponse) => void,
    intervalMs: number = 2000,
    maxAttempts: number = 180 // 最多轮询 6 分钟 (180秒 / 2秒 = 90次)
  ): Promise<void> {
    let attempts = 0;

    console.log(`[ClawbotPairing] 开始轮询配对状态 (requestId: ${requestId})`);

    return new Promise((resolve, reject) => {
      this.pollingInterval = setInterval(async () => {
        attempts++;

        // 从 Supabase 查询状态
        const { data, error } = await supabase
          .from('pairing_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (error) {
          console.error('[ClawbotPairing] 查询状态失败:', error);
          // 继续轮询，不要因为单次查询失败就停止
          return;
        }

        if (!data) {
          // 请求不存在，可能已过期
          console.warn('[ClawbotPairing] 配对请求不存在');
          onStatusChange({
            requestId,
            status: 'denied',
            message: '配对请求不存在'
          });
          clearInterval(this.pollingInterval!);
          resolve();
          return;
        }

        const response = data as PairingRequest;

        console.log(`[ClawbotPairing] 轮询第 ${attempts} 次，状态: ${response.status}`);

        switch (response.status) {
          case 'approved':
            clearInterval(this.pollingInterval!);
            console.log('[ClawbotPairing] 配对成功！');
            onStatusChange({
              requestId,
              status: 'approved',
              deviceToken: response.device_token || undefined
            });
            resolve();
            break;

          case 'denied':
          case 'cancelled':
            clearInterval(this.pollingInterval!);
            console.log('[ClawbotPairing] 配对被拒绝或取消');
            onStatusChange({
              requestId,
              status: response.status,
              message: response.message || '配对未通过'
            });
            resolve();
            break;

          case 'expired':
            clearInterval(this.pollingInterval!);
            console.log('[ClawbotPairing] 配对已过期');
            onStatusChange({
              requestId,
              status: 'expired',
              message: '配对请求已过期'
            });
            resolve();
            break;

          case 'pending':
            // 继续等待
            if (attempts >= maxAttempts) {
              clearInterval(this.pollingInterval!);
              console.log('[ClawbotPairing] 轮询超时');
              onStatusChange({
                requestId,
                status: 'expired',
                message: '配对超时，请重试'
              });
              resolve();
            }
            break;
        }
      }, intervalMs);
    });
  }

  /**
   * 取消配对请求
   */
  async cancelPairingRequest(requestId: string): Promise<void> {
    try {
      console.log('[ClawbotPairing] 取消配对请求:', requestId);

      const { error } = await supabase
        .from('pairing_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId);

      if (error) {
        console.error('[ClawbotPairing] 取消配对失败:', error);
        throw new Error('取消配对失败');
      }

      // 停止轮询
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval!);
        this.pollingInterval = null;
      }

      this.currentRequestId = null;
    } catch (error) {
      console.error('[ClawbotPairing] 取消配对异常:', error);
      throw error;
    }
  }

  /**
   * 清理过期的配对请求（可选的后台任务）
   */
  async cleanupExpiredRequests(): Promise<void> {
    const expiredTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 小时前

    const { error } = await supabase
      .from('pairing_requests')
      .delete()
      .lt('created_at', expiredTime);

    if (error) {
      console.error('[ClawbotPairing] 清理过期请求失败:', error);
    }
  }

  /**
   * 获取 Gateway IP 地址（用于手动连接）
   */
  getGatewayPublicIP(): string {
    // 从 ws:// 提取 IP 和端口
    const url = new URL(this.gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://'));
    return `${url.hostname}:${url.port || 18789}`;
  }
}

export default new ClawbotPairingService();
