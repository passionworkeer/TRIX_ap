import { supabase } from '../config/supabase';
import {
  PairingRequest,
  PairingResponse,
  QRCodeData,
  PairingStatus,
  PairingStatusResponse,
  PAIRING_TIMEOUT_MS,
  DEFAULT_QR_SIZE,
} from '../types/clawbot';

/**
 * Clawbot 扫码配对服务
 *
 * 基于 Clawdbot Gateway 集成指南 v1.0.0
 *
 * 功能说明：
 * 1. 生成配对请求 - 手机端发起配对
 * 2. 获取二维码内容 - 生成供 Gateway 扫描的二维码数据
 * 3. 轮询配对状态 - 等待电脑端审批
 * 4. 审批通过后使用 device_token 连接 WebSocket
 * 5. 支持取消配对和清理过期请求
 */

/**
 * 配对服务配置选项
 */
interface PairingServiceOptions {
  /** Gateway WebSocket URL */
  gatewayUrl?: string;
  /** Gateway 认证 Token */
  authToken?: string;
  /** 轮询间隔（毫秒） */
  pollInterval?: number;
  /** 最大轮询次数 */
  maxPollAttempts?: number;
}

class ClawbotPairingService {
  private gatewayUrl: string;
  private authToken: string;
  private pollInterval: number;
  private maxPollAttempts: number;
  private pollingTimer: NodeJS.Timeout | null = null;
  private currentRequestId: string | null = null;

  constructor(options?: PairingServiceOptions) {
    // 从环境变量或选项读取 Gateway 配置
    this.gatewayUrl = options?.gatewayUrl
      || import.meta.env.VITE_CLAWBOT_GATEWAY_URL
      || 'ws://localhost:18789';

    this.authToken = options?.authToken
      || import.meta.env.VITE_CLAWBOT_GATEWAY_TOKEN
      || '';

    this.pollInterval = options?.pollInterval || 2000;
    this.maxPollAttempts = options?.maxPollAttempts || 180;

    console.log('[ClawbotPairingService] 初始化', {
      gatewayUrl: this.gatewayUrl,
      hasToken: !!this.authToken,
      pollInterval: this.pollInterval,
    });
  }

  /**
   * 生成配对请求
   *
   * 流程：
   * 1. 生成唯一请求 ID
   * 2. 获取设备信息
   * 3. 存储到 Supabase 供 Gateway 读取
   *
   * @param deviceName - 设备名称（可选）
   * @returns 配对请求对象
   */
  async generatePairingRequest(deviceName?: string): Promise<PairingRequest> {
    // 生成唯一请求 ID
    const requestId = this.generateRequestId();

    // 获取设备信息
    const deviceId = this.getOrCreateDeviceId();
    const defaultDeviceName = deviceName || `TRIX-${navigator.platform || 'Web'}`;

    const request: PairingRequest = {
      requestId,
      deviceName: defaultDeviceName,
      deviceType: 'mobile',
      timestamp: Date.now(),
      status: 'pending',
      deviceId,
      metadata: {
        deviceName: defaultDeviceName,
        deviceType: 'mobile',
        platform: navigator.platform,
        userAgent: navigator.userAgent,
      },
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
          status: 'pending' as PairingStatus,
          platform: navigator.platform,
          user_agent: navigator.userAgent,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + PAIRING_TIMEOUT_MS).toISOString(),
        }]);

      if (error) {
        console.error('[ClawbotPairingService] 存储配对请求失败:', error);
        throw new Error(`存储配对请求失败: ${error.message}`);
      }

      this.currentRequestId = requestId;
      console.log('[ClawbotPairingService] ✅ 配对请求已生成:', requestId);

      return request;
    } catch (error) {
      console.error('[ClawbotPairingService] 生成配对请求失败:', error);
      throw error;
    }
  }

  /**
   * 获取二维码内容
   *
   * 供 Gateway 生成二维码使用（电脑端显示二维码）
   * 手机端扫描二维码后解析此数据
   *
   * @param requestId - 配对请求 ID
   * @returns JSON 格式的二维码数据
   */
  getQRCodeContent(requestId: string): string {
    const qrData: QRCodeData = {
      gatewayUrl: this.gatewayUrl,
      pairingToken: this.authToken,
      requestId,
      expiresAt: new Date(Date.now() + PAIRING_TIMEOUT_MS).toISOString(),
    };

    return JSON.stringify(qrData);
  }

  /**
   * 解析二维码内容
   *
   * 手机端扫描二维码后调用此方法解析
   *
   * @param qrContent - 二维码内容
   * @returns 解析后的二维码数据
   */
  parseQRCodeContent(qrContent: string): QRCodeData {
    try {
      const data = JSON.parse(qrContent) as QRCodeData;

      // 验证必要字段
      if (!data.gatewayUrl || !data.pairingToken) {
        throw new Error('二维码数据缺少必要字段 (gatewayUrl 或 pairingToken)');
      }

      // 检查是否过期
      if (new Date(data.expiresAt) < new Date()) {
        throw new Error('二维码已过期');
      }

      return data;
    } catch (error) {
      console.error('[ClawbotPairingService] 解析二维码失败:', error);
      throw new Error('无效的二维码格式');
    }
  }

  /**
   * 轮询配对状态
   *
   * 持续查询 Supabase 中的配对状态，直到：
   * - 配对成功 (approved)
   * - 配对被拒绝 (denied)
   * - 配对被取消 (cancelled)
   * - 配对过期 (expired)
   * - 达到最大轮询次数
   *
   * @param requestId - 请求 ID
   * @param onStatusChange - 状态变化回调
   * @param intervalMs - 轮询间隔（毫秒）
   * @param maxAttempts - 最大尝试次数
   */
  async pollPairingStatus(
    requestId: string,
    onStatusChange: (response: PairingResponse) => void,
    intervalMs: number = this.pollInterval,
    maxAttempts: number = this.maxPollAttempts,
  ): Promise<void> {
    let attempts = 0;

    console.log(`[ClawbotPairingService] 开始轮询配对状态 (requestId: ${requestId})`);

    return new Promise((resolve, reject) => {
      this.pollingTimer = setInterval(async () => {
        attempts++;

        try {
          // 从 Supabase 查询状态
          const { data, error } = await supabase
            .from('pairing_requests')
            .select('*')
            .eq('id', requestId)
            .single();

          if (error) {
            console.error('[ClawbotPairingService] 查询状态失败:', error);
            // 继续轮询，不要因为单次查询失败就停止
            return;
          }

          if (!data) {
            // 请求不存在，可能已过期被清理
            console.warn('[ClawbotPairingService] 配对请求不存在');
            this.stopPolling();
            onStatusChange({
              requestId,
              status: 'expired',
              message: '配对请求不存在或已被清理',
            });
            resolve();
            return;
          }

          const status = data.status as PairingStatus;
          console.log(`[ClawbotPairingService] 轮询第 ${attempts} 次，状态: ${status}`);

          switch (status) {
            case 'approved':
              this.stopPolling();
              console.log('[ClawbotPairingService] ✅ 配对成功！');

              // 保存设备 token
              if (data.device_token) {
                localStorage.setItem('clawbot_device_token', data.device_token);
                localStorage.setItem('clawbot_node_id', data.node_id || '');
              }

              onStatusChange({
                requestId,
                status: 'approved',
                deviceToken: data.device_token,
                nodeId: data.node_id,
                message: '配对成功',
              });
              resolve();
              break;

            case 'denied':
              this.stopPolling();
              console.log('[ClawbotPairingService] ❌ 配对被拒绝');
              onStatusChange({
                requestId,
                status: 'denied',
                message: data.message || '电脑端拒绝了配对请求',
              });
              resolve();
              break;

            case 'cancelled':
              this.stopPolling();
              console.log('[ClawbotPairingService] ⚠️ 配对已取消');
              onStatusChange({
                requestId,
                status: 'cancelled',
                message: '配对已取消',
              });
              resolve();
              break;

            case 'expired':
              this.stopPolling();
              console.log('[ClawbotPairingService] ⏰ 配对已过期');
              onStatusChange({
                requestId,
                status: 'expired',
                message: '配对请求已过期',
              });
              resolve();
              break;

            case 'pending':
              // 继续等待
              if (attempts >= maxAttempts) {
                this.stopPolling();
                console.log('[ClawbotPairingService] ⏰ 轮询超时');

                // 更新状态为过期
                await supabase
                  .from('pairing_requests')
                  .update({ status: 'expired' })
                  .eq('id', requestId);

                onStatusChange({
                  requestId,
                  status: 'expired',
                  message: '配对超时，请重试',
                });
                resolve();
              }
              break;

            default:
              console.warn('[ClawbotPairingService] 未知状态:', status);
          }
        } catch (error) {
          console.error('[ClawbotPairingService] 轮询过程出错:', error);
          // 继续轮询，不要因单次错误中断
        }
      }, intervalMs);
    });
  }

  /**
   * 取消配对请求
   *
   * @param requestId - 请求 ID
   */
  async cancelPairingRequest(requestId: string): Promise<void> {
    try {
      console.log('[ClawbotPairingService] 取消配对请求:', requestId);

      const { error } = await supabase
        .from('pairing_requests')
        .update({
          status: 'cancelled' as PairingStatus,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) {
        console.error('[ClawbotPairingService] 取消配对失败:', error);
        throw new Error('取消配对失败');
      }

      this.stopPolling();
      this.currentRequestId = null;

      console.log('[ClawbotPairingService] ✅ 配对已取消');
    } catch (error) {
      console.error('[ClawbotPairingService] 取消配对异常:', error);
      throw error;
    }
  }

  /**
   * 检查配对状态
   *
   * @param nodeId - 节点 ID（可选）
   * @returns 配对状态
   */
  async checkPairingStatus(nodeId?: string): Promise<PairingStatusResponse> {
    try {
      const deviceToken = localStorage.getItem('clawbot_device_token');

      if (!deviceToken) {
        return { paired: false, connected: false };
      }

      // 查询最新的配对记录
      const { data, error } = await supabase
        .from('pairing_requests')
        .select('*')
        .eq('device_id', this.getOrCreateDeviceId())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return { paired: false, connected: false };
      }

      const isPaired = data.status === 'approved';
      const isExpired = new Date(data.expires_at) < new Date();

      return {
        paired: isPaired && !isExpired,
        connected: isPaired && !isExpired,
        deviceInfo: isPaired ? {
          deviceId: data.device_id,
          deviceName: data.device_name,
          pairedAt: data.created_at,
        } : undefined,
      };
    } catch (error) {
      console.error('[ClawbotPairingService] 检查配对状态失败:', error);
      return { paired: false, connected: false };
    }
  }

  /**
   * 清理过期的配对请求
   *
   * 可选的后台任务，定期清理过期数据
   */
  async cleanupExpiredRequests(): Promise<void> {
    const expiredTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    try {
      const { error } = await supabase
        .from('pairing_requests')
        .delete()
        .lt('created_at', expiredTime);

      if (error) {
        console.error('[ClawbotPairingService] 清理过期请求失败:', error);
      } else {
        console.log('[ClawbotPairingService] ✅ 已清理过期配对请求');
      }
    } catch (error) {
      console.error('[ClawbotPairingService] 清理过期请求异常:', error);
    }
  }

  /**
   * 获取存储的设备 Token
   */
  getStoredDeviceToken(): string | null {
    return localStorage.getItem('clawbot_device_token');
  }

  /**
   * 获取存储的节点 ID
   */
  getStoredNodeId(): string | null {
    return localStorage.getItem('clawbot_node_id');
  }

  /**
   * 清除存储的配对信息
   */
  clearStoredCredentials(): void {
    localStorage.removeItem('clawbot_device_token');
    localStorage.removeItem('clawbot_node_id');
    localStorage.removeItem('clawbot_gateway_url');
    localStorage.removeItem('clawbot_pairing_token');
  }

  /**
   * 获取 Gateway 公网 IP 地址
   *
   * 用于手动连接时显示
   */
  getGatewayPublicIP(): string {
    const url = new URL(
      this.gatewayUrl.replace('ws://', 'http://').replace('wss://', 'https://')
    );
    return `${url.hostname}:${url.port || 18789}`;
  }

  /**
   * 获取 Gateway URL
   */
  getGatewayUrl(): string {
    return this.gatewayUrl;
  }

  /**
   * 设置 Gateway URL
   */
  setGatewayUrl(url: string): void {
    this.gatewayUrl = url;
  }

  /**
   * 获取当前请求 ID
   */
  getCurrentRequestId(): string | null {
    return this.currentRequestId;
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 生成唯一请求 ID
   */
  private generateRequestId(): string {
    return `trix-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 获取或创建设备唯一 ID
   */
  private getOrCreateDeviceId(): string {
    const storageKey = 'trix_device_id';
    let deviceId = localStorage.getItem(storageKey);

    if (!deviceId) {
      deviceId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(storageKey, deviceId);
    }

    return deviceId;
  }

  /**
   * 停止轮询
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}

// 导出单例实例
export default new ClawbotPairingService();

// 导出类供需要自定义配置时使用
export { ClawbotPairingService };
