import { supabase } from '../config/supabase';
import {
  PairingRequest,
  PairingResponse,
  QRCodeData,
  PairingStatus,
  PairingStatusResponse,
  PAIRING_TIMEOUT_MS,
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

  // ngrok 默认 Token（从文档获取）
  private static readonly DEFAULT_NGROK_TOKEN = '__PC_AUTH_TOKEN_REDACTED__';

  constructor(options?: PairingServiceOptions) {
    // 从环境变量或选项读取 Gateway 配置
    this.gatewayUrl = options?.gatewayUrl
      || import.meta.env.VITE_CLAWBOT_GATEWAY_URL
      || 'ws://localhost:18789';

    // 优先使用传入的 token，其次环境变量，最后默认 ngrok token
    this.authToken = options?.authToken
      || import.meta.env.VITE_CLAWBOT_GATEWAY_TOKEN
      || ClawbotPairingService.DEFAULT_NGROK_TOKEN;

    this.pollInterval = options?.pollInterval || 2000;
    this.maxPollAttempts = options?.maxPollAttempts || 180;

    console.log('[ClawbotPairingService] 初始化', {
      gatewayUrl: this.gatewayUrl,
      hasToken: !!this.authToken,
      isNgrok: this.gatewayUrl.includes('ngrok'),
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
  /**
   * 获取 API 基础 URL
   * 开发环境使用 Vite 代理，生产环境直接访问
   */
  private getApiBaseUrl(): string {
    // 开发环境使用代理路径
    if (import.meta.env.DEV) {
      const baseUrl = '/gateway';
      console.log('[ClawbotPairingService] 使用开发代理:', baseUrl);
      return baseUrl;
    }

    // 生产环境直接使用 Gateway URL
    const baseUrl = this.gatewayUrl
      .replace('wss://', 'https://')
      .replace('ws://', 'http://')
      .replace('/ws', '');
    console.log('[ClawbotPairingService] API Base URL:', baseUrl);
    return baseUrl;
  }

  /**
   * 直接连接模式 - 跳过 HTTP API 配对，直接使用 WebSocket
   * 适用于 webchat 模式（无需配对）
   *
   * @param gatewayUrl - Gateway WebSocket URL
   * @param authToken - Auth Token
   * @returns 是否成功保存配置
   */
  directConnect(gatewayUrl: string, authToken: string): boolean {
    try {
      console.log('[ClawbotPairingService] 直接连接模式');
      console.log('[Debug] Gateway URL:', gatewayUrl);
      console.log('[Debug] Auth Token:', authToken ? `${authToken.substring(0, 10)}...` : 'undefined');

      // 保存到 localStorage
      localStorage.setItem('clawbot_gateway_url', gatewayUrl);
      localStorage.setItem('clawbot_device_token', authToken); // 使用 token 作为 device_token

      console.log('[ClawbotPairingService] ✅ 直接连接配置已保存');
      return true;
    } catch (error) {
      console.error('[ClawbotPairingService] 保存配置失败:', error);
      return false;
    }
  }

  /**
   * 发送配对请求到 Clawbot Gateway HTTP API
   * 用于支持直接 HTTP API 模式的 Gateway
   *
   * API 文档: POST /pairing/request
   */
  private async sendPairingRequestToGateway(
    _requestId: string,
    deviceId: string,
    deviceName: string,
    _pairingToken: string
  ): Promise<{ success: boolean; deviceToken?: string; requestId?: string; message?: string; status?: string }> {
    try {
      // 获取 API URL（自动处理代理）
      const httpUrl = this.getApiBaseUrl();

      // 注意：API 路径是 /pairing/request，不是 /api/pairing/request
      const apiUrl = `${httpUrl}/pairing/request`;

      const requestBody = {
        device_id: deviceId,
        device_name: deviceName,
        device_type: 'mobile',
        auto_approve: true,  // 启用自动确认模式
        metadata: {
          platform: navigator.platform,
          userAgent: navigator.userAgent,
        },
      };

      // 详细日志
      console.log('========== 配对请求调试 ==========');
      console.log('[Debug] API URL:', apiUrl);
      console.log('[Debug] Auth Token:', this.authToken ? `${this.authToken.substring(0, 10)}...` : 'undefined');
      console.log('[Debug] Request Body:', JSON.stringify(requestBody, null, 2));
      console.log('==================================');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      // 详细响应日志
      console.log('========== 配对响应调试 ==========');
      console.log('[Debug] Status:', response.status, response.statusText);
      console.log('[Debug] Content-Type:', response.headers.get('content-type'));
      console.log('==================================');

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[ClawbotPairingService] Gateway API 返回错误:', response.status, errorText);
        console.warn('[Debug] 错误响应内容 (前500字符):', errorText.substring(0, 500));
        return { success: false, message: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      console.log('[ClawbotPairingService] Gateway API 响应:', data);

      return {
        success: data.success,
        deviceToken: data.deviceToken || data.device_token,
        requestId: data.requestId || data.request_id,
        status: data.status,
        message: data.message,
      };
    } catch (error) {
      console.error('[Debug] 捕获异常:', error);
      console.warn('[ClawbotPairingService] 调用 Gateway API 失败:', error);
      return { success: false, message: error instanceof Error ? error.message : '网络错误' };
    }
  }

  /**
   * 轮询 Clawbot Gateway HTTP API 获取配对状态
   * 用于替代 Supabase 轮询
   */
  async pollPairingStatusViaGateway(
    requestId: string,
    onStatusChange: (response: PairingResponse) => void,
    intervalMs: number = 2000,
    maxAttempts: number = 180
  ): Promise<void> {
    const httpUrl = this.getApiBaseUrl();

    let attempts = 0;
    console.log(`[ClawbotPairingService] 开始轮询 Gateway API (requestId: ${requestId})`);
    console.log('[Debug] 轮询 URL 基础:', httpUrl);

    return new Promise((resolve) => {
      this.pollingTimer = setInterval(async () => {
        attempts++;

        try {
          const apiUrl = `${httpUrl}/pairing/status/${requestId}`;

          // 详细日志（每10次输出一次）
          if (attempts % 10 === 1) {
            console.log(`[Debug] 轮询第 ${attempts} 次, URL: ${apiUrl}`);
          }

          const response = await fetch(apiUrl, {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${this.authToken}`,
            },
          });

          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            console.warn(`[Debug] 轮询失败: Status=${response.status}, Content-Type=${contentType}`);

            // 如果返回 HTML，说明 API 不存在，回退到 Supabase
            if (contentType && contentType.includes('text/html')) {
              console.warn('[ClawbotPairingService] Gateway 不支持轮询 API (返回 HTML)，停止轮询');
              this.stopPolling();
              resolve();
              return;
            }
            return;
          }

          const data = await response.json();
          console.log(`[ClawbotPairingService] 轮询第 ${attempts} 次，状态: ${data.status}`);

          switch (data.status) {
            case 'approved':
              this.stopPolling();
              onStatusChange({
                requestId,
                status: 'approved',
                deviceToken: data.deviceToken || data.device_token,
                message: data.message || '配对成功',
              });
              // 保存 token 和 gateway_url 到 localStorage
              if (data.deviceToken || data.device_token) {
                localStorage.setItem('clawbot_device_token', data.deviceToken || data.device_token);
                localStorage.setItem('clawbot_gateway_url', this.gatewayUrl);
              }
              resolve();
              break;

            case 'denied':
            case 'cancelled':
            case 'expired':
              this.stopPolling();
              onStatusChange({
                requestId,
                status: data.status,
                message: data.message || '配对失败',
              });
              resolve();
              break;

            case 'pending':
              if (attempts >= maxAttempts) {
                this.stopPolling();
                onStatusChange({
                  requestId,
                  status: 'expired',
                  message: '配对超时，请重试',
                });
                resolve();
              }
              break;

            default:
              console.warn('[ClawbotPairingService] 未知状态:', data.status);
          }
        } catch (error) {
          console.error('[ClawbotPairingService] 轮询过程出错:', error);
        }
      }, intervalMs);
    });
  }

  async generatePairingRequest(deviceName?: string, pairingToken?: string): Promise<PairingRequest> {
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
      // 尝试通过 HTTP API 发送配对请求（用于直接 API 模式的 Gateway）
      const token = pairingToken || this.authToken;
      if (token) {
        const apiResult = await this.sendPairingRequestToGateway(
          requestId,
          deviceId,
          defaultDeviceName,
          token
        );

        if (apiResult.success && apiResult.deviceToken) {
          // Gateway 立即返回了 deviceToken（自动确认模式）
          console.log('[ClawbotPairingService] ✅ Gateway 自动确认，立即获得 deviceToken');
          request.device_token = apiResult.deviceToken;
          request.status = 'approved';

          // 保存到 Supabase 用于记录（不阻塞主流程）
          try {
            await supabase.from('pairing_requests').insert([{
              id: requestId,
              device_id: deviceId,
              device_name: defaultDeviceName,
              device_type: 'mobile',
              status: 'approved' as PairingStatus,
              device_token: apiResult.deviceToken,
              platform: navigator.platform,
              user_agent: navigator.userAgent,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + PAIRING_TIMEOUT_MS).toISOString(),
            }]);
          } catch (err) {
            console.warn('[ClawbotPairingService] Supabase 记录失败:', err);
          }

          this.currentRequestId = requestId;
          return request;
        }
      }

      // 回退到 Supabase 模式（Gateway 轮询）
      console.log('[ClawbotPairingService] 使用 Supabase 模式，等待 Gateway 轮询...');

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
   * 支持 camelCase 和 snake_case 两种字段命名风格
   *
   * @param qrContent - 二维码内容
   * @returns 解析后的二维码数据
   */
  parseQRCodeContent(qrContent: string): QRCodeData {
    try {
      const rawData = JSON.parse(qrContent) as Record<string, any>;

      // 字段映射：支持 camelCase 和 snake_case
      const data: QRCodeData = {
        // gatewayUrl: 优先取 camelCase，其次 snake_case
        gatewayUrl: rawData.gatewayUrl || rawData.gateway_url || '',
        // pairingToken: 优先取 camelCase，其次 snake_case
        pairingToken: rawData.pairingToken || rawData.pairing_token || '',
        // requestId: 优先取 camelCase，其次 snake_case，最后 device_id/deviceId
        requestId: rawData.requestId || rawData.request_id || rawData.deviceId || rawData.device_id || '',
        // expiresAt: 优先取 camelCase，其次 snake_case
        expiresAt: rawData.expiresAt || rawData.expires_at || new Date(Date.now() + PAIRING_TIMEOUT_MS).toISOString(),
      };

      // 验证必要字段
      if (!data.gatewayUrl) {
        throw new Error('二维码数据缺少必要字段: gatewayUrl/gateway_url');
      }
      if (!data.pairingToken) {
        throw new Error('二维码数据缺少必要字段: pairingToken/pairing_token');
      }

      // 检查是否过期
      if (new Date(data.expiresAt) < new Date()) {
        throw new Error('二维码已过期');
      }

      console.log('[ClawbotPairingService] 解析二维码成功:', {
        gatewayUrl: data.gatewayUrl,
        hasToken: !!data.pairingToken,
        requestId: data.requestId,
        expiresAt: data.expiresAt,
      });

      return data;
    } catch (error) {
      console.error('[ClawbotPairingService] 解析二维码失败:', error);
      throw new Error('无效的二维码格式');
    }
  }

  /**
   * 从原始 JSON 数据中提取配对信息
   * 用于手动输入时单独提取各个字段
   */
  extractPairingInfo(rawData: Record<string, any>): {
    gatewayUrl: string;
    pairingToken: string;
    deviceId: string;
    expiresAt: string;
    version?: string;
  } {
    return {
      gatewayUrl: rawData.gatewayUrl || rawData.gateway_url || '',
      pairingToken: rawData.pairingToken || rawData.pairing_token || '',
      deviceId: rawData.deviceId || rawData.device_id || '',
      expiresAt: rawData.expiresAt || rawData.expires_at || '',
      version: rawData.version,
    };
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

    return new Promise((resolve) => {
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

              // 保存设备 token 和 gateway_url
              if (data.device_token) {
                localStorage.setItem('clawbot_device_token', data.device_token);
                localStorage.setItem('clawbot_node_id', data.node_id || '');
                localStorage.setItem('clawbot_gateway_url', this.gatewayUrl);
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
   * 通过 Gateway HTTP API 取消配对请求
   *
   * @param requestId - 请求 ID
   */
  async cancelPairingRequest(requestId: string): Promise<void> {
    try {
      console.log('[ClawbotPairingService] 取消配对请求:', requestId);

      // 尝试通过 Gateway API 取消（可选，Gateway 可能不支持）
      const httpUrl = this.getApiBaseUrl();

      try {
        const apiUrl = `${httpUrl}/pairing/deny/${requestId}`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken}`,
          },
        });

        if (response.ok) {
          console.log('[ClawbotPairingService] ✅ Gateway 取消成功');
        } else if (response.status === 405 || response.status === 404) {
          // Gateway 不支持此 API 或不存在，忽略错误
          console.log('[ClawbotPairingService] Gateway 不支持 deny API，使用本地取消');
        } else {
          console.warn('[ClawbotPairingService] Gateway 取消失败:', response.status);
        }
      } catch (apiError) {
        // 忽略网络错误，继续更新本地状态
        console.log('[ClawbotPairingService] Gateway API 调用失败，使用本地取消');
      }

      // 更新 Supabase（用于记录和状态同步）
      const { error } = await supabase
        .from('pairing_requests')
        .update({
          status: 'cancelled' as PairingStatus,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) {
        console.error('[ClawbotPairingService] Supabase 更新失败:', error);
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
  async checkPairingStatus(_nodeId?: string): Promise<PairingStatusResponse> {
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
    console.log('[ClawbotPairingService] 更新 Gateway URL:', url);
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
