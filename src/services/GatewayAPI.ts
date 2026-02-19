/**
 * GatewayAPI - OpenClaw-CN Gateway WebSocket API 封装
 *
 * 功能：
 * - 复用 ConnectionManager 进行 WebSocket 连接管理
 * - 实现 OpenClaw Gateway 认证协议
 * - Promise 化的 API 调用封装
 */

import connectionManager from './ConnectionManager';
import type {
  GatewayConnectionStatus,
  GatewayAPIMethod,
  UsageCostData,
  SessionUsage,
  TimeSeriesData,
  UsageStatus,
  SessionListItem
} from '../types/tokenMonitor';

interface GatewayMessageEvent {
  type: string;
  payload?: Record<string, unknown>;
}

interface MessageRoutingConfig {
  showSubagentMessages: boolean;
  showInternalMessages: boolean;
  showDebugMessages: boolean;
  allowedTargets: string[];
}

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 生成实例 ID
function generateInstanceId(): string {
  return `token-monitor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

class GatewayAPI {
  private connectionId: string = 'openclaw-gateway';
  private instanceId: string = generateInstanceId();
  private connectionStatus: GatewayConnectionStatus = 'DISCONNECTED';
  private pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
  > = new Map();
  private onStatusChange?: (status: GatewayConnectionStatus) => void;
  private onMessage?: (event: GatewayMessageEvent) => void;
  private routingConfig: MessageRoutingConfig = {
    showSubagentMessages: false,  // 默认不显示子代理消息
    showInternalMessages: false,  // 默认不显示内部消息
    showDebugMessages: false,     // 默认不显示调试消息
    allowedTargets: ['user']      // 默认只显示用户消息
  };

  /**
   * 连接到 Gateway
   */
  async connect(url: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[GatewayAPI] 开始连接到 Gateway:', url);

      this.connectionStatus = 'CONNECTING';
      this.onStatusChange?.('CONNECTING');

      // 清理旧连接
      connectionManager.disconnect(this.connectionId);

      let settled = false;
      let authRequestSent = false;
      let authTimeout: ReturnType<typeof setTimeout> | null = null;

      const settle = (handler: () => void) => {
        if (settled) return;
        settled = true;
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }
        handler();
      };

      const handleAuthMessage = (data: unknown) => {
        const messageType = this.getMessageType(data);

        if (this.isConnectChallenge(data) && !authRequestSent) {
          console.log('[GatewayAPI] 收到认证挑战，发送认证响应');
          authRequestSent = true;

          const authParams = {
            minProtocol: 3,
            maxProtocol: 3,
            role: 'operator',
            client: {
              id: 'token-monitor',
              displayName: 'Token Monitor',
              version: '1.0.0',
              platform: 'web',
              mode: 'monitor',
              instanceId: this.instanceId
            },
            auth: {
              token
            }
          };

          const requestId =
            (typeof data === 'object' &&
              data !== null &&
              'payload' in data &&
              typeof (data as { payload: unknown }).payload === 'object' &&
              (data as { payload: { nonce?: string } }).payload !== null &&
              'nonce' in (data as { payload: { nonce?: string } }).payload
              ? (data as { payload: { nonce?: string } }).payload.nonce
              : undefined) || generateId();

          connectionManager.send(this.connectionId, {
            type: 'req',
            id: requestId,
            method: 'connect',
            params: authParams
          });
          return;
        }

        if (this.isHelloOk(data)) {
          console.log('[GatewayAPI] 认证成功');
          this.connectionStatus = 'AUTHENTICATED';
          this.onStatusChange?.('AUTHENTICATED');
          settle(() => resolve());
          return;
        }

        if (messageType === 'error') {
          const errorMessage =
            typeof data === 'object' &&
            data !== null &&
            'error' in data &&
            typeof (data as { error: unknown }).error === 'object' &&
            (data as { error: { message?: string } }).error !== null
              ? (data as { error: { message?: string } }).error.message
              : undefined;

          if (errorMessage) {
            settle(() => reject(new Error(`认证失败: ${errorMessage}`)));
          }
        }
      };

      // 创建新连接
      const socket = connectionManager.connect(this.connectionId, url, {
        heartbeatInterval: 30000,
        reconnect: true,
        reconnectDelay: 2000,
        reconnectAttempts: 10,
        onMessage: (data) => {
          handleAuthMessage(data);
          this.handleMessage(data);
        },
        onConnected: () => {
          console.log('[GatewayAPI] WebSocket 连接成功，等待认证挑战');
          this.connectionStatus = 'CONNECTED';
          this.onStatusChange?.('CONNECTED');
        },
        onDisconnected: () => {
          console.log('[GatewayAPI] 连接断开');
          this.connectionStatus = 'DISCONNECTED';
          this.onStatusChange?.('DISCONNECTED');
          // 清理所有待处理的请求
          this.pendingRequests.forEach(({ reject: rejectReq, timeout }) => {
            clearTimeout(timeout);
            rejectReq(new Error('连接已断开'));
          });
          this.pendingRequests.clear();

          if (!settled) {
            settle(() => reject(new Error('连接已断开')));
          }
        },
        onError: (error) => {
          console.error('[GatewayAPI] 连接错误:', error);
          this.connectionStatus = 'ERROR';
          this.onStatusChange?.('ERROR');
          if (!settled) {
            settle(() => reject(new Error('连接失败')));
          }
        }
      });

      if (!socket) {
        settle(() => reject(new Error('无法创建 WebSocket 连接')));
        return;
      }

      // 设置认证超时
      authTimeout = setTimeout(() => {
        if (this.connectionStatus !== 'AUTHENTICATED') {
          settle(() => reject(new Error('认证超时')));
        }
      }, 10000);
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    console.log('[GatewayAPI] 断开连接');
    connectionManager.disconnect(this.connectionId);
    this.connectionStatus = 'DISCONNECTED';
    this.onStatusChange?.('DISCONNECTED');

    // 清理所有待处理的请求
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('连接已断开'));
    });
    this.pendingRequests.clear();
  }

  /**
   * 调用 Gateway API
   */
  async callAPI<T>(method: GatewayAPIMethod, params?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.connectionStatus !== 'AUTHENTICATED') {
        reject(new Error('未认证，无法调用 API'));
        return;
      }

      const requestId = generateId();
      const request = {
        type: 'req' as const,
        id: requestId,
        method,
        params: params || {}
      };

      console.log('[GatewayAPI] 调用 API:', method, params);

      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`API 调用超时: ${method}`));
      }, 15000);

      // 保存待处理请求
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout
      });

      // 发送请求
      const sent = connectionManager.send(this.connectionId, request);
      if (!sent) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error('发送请求失败'));
      }
    });
  }

  /**
   * 获取使用成本数据
   */
  async getUsageCost(startDate?: Date, endDate?: Date, days?: number): Promise<UsageCostData> {
    const params: Record<string, unknown> = {};

    if (startDate && endDate) {
      params.startDate = this.formatDate(startDate);
      params.endDate = this.formatDate(endDate);
    } else if (days) {
      params.days = days;
    }

    return this.callAPI<UsageCostData>('usage.cost', params);
  }

  /**
   * 获取会话使用统计
   */
  async getSessionsUsage(
    startDate?: Date,
    endDate?: Date,
    limit?: number,
    key?: string
  ): Promise<SessionUsage[]> {
    const params: Record<string, unknown> = {};

    if (startDate && endDate) {
      params.startDate = this.formatDate(startDate);
      params.endDate = this.formatDate(endDate);
    }

    if (limit) {
      params.limit = limit;
    }

    if (key) {
      params.key = key;
    }

    return this.callAPI<SessionUsage[]>('sessions.usage', params);
  }

  /**
   * 获取时间序列数据
   */
  async getTimeSeriesData(key?: string): Promise<TimeSeriesData[]> {
    const params: Record<string, unknown> = {};

    if (key) {
      params.key = key;
    }

    return this.callAPI<TimeSeriesData[]>('sessions.usage.timeseries', params);
  }

  /**
   * 获取会话列表
   */
  async getSessionsList(agentId?: string, channel?: string, limit?: number): Promise<SessionListItem[]> {
    const params: Record<string, unknown> = {};

    if (agentId) {
      params.agentId = agentId;
    }

    if (channel) {
      params.channel = channel;
    }

    if (limit) {
      params.limit = limit;
    }

    return this.callAPI<SessionListItem[]>('sessions.list', params);
  }

  /**
   * 获取使用状态
   */
  async getUsageStatus(): Promise<UsageStatus> {
    return this.callAPI<UsageStatus>('usage.status');
  }

  /**
   * 获取连接状态
   */
  getStatus(): GatewayConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * 设置状态变更回调
   */
  setOnStatusChange(callback: (status: GatewayConnectionStatus) => void): void {
    this.onStatusChange = callback;
  }

  /**
   * 设置消息接收回调
   */
  setOnMessage(callback: (event: GatewayMessageEvent) => void): void {
    this.onMessage = callback;
  }

  /**
   * 设置消息路由配置
   */
  setRoutingConfig(config: Partial<MessageRoutingConfig>): void {
    this.routingConfig = { ...this.routingConfig, ...config };
    console.log('[GatewayAPI] 消息路由配置已更新:', this.routingConfig);
  }

  /**
   * 获取消息路由配置
   */
  getRoutingConfig(): MessageRoutingConfig {
    return { ...this.routingConfig };
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: unknown): void {
    // 处理响应
    if (this.isResponse(data)) {
      const { id, payload, error } = data;
      const pending = this.pendingRequests.get(id);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(id);

        if (error) {
          console.error('[GatewayAPI] API 错误:', error);
          pending.reject(new Error(error.message || 'API 调用失败'));
        } else {
          console.log('[GatewayAPI] API 响应:', id, payload);
          pending.resolve(payload);
        }
      }
    }

    // 处理消息事件
    if (this.isMessageEvent(data)) {
      this.handleMessageEvent(data);
    }
  }

  /**
   * 处理消息事件并进行路由过滤
   */
  private handleMessageEvent(data: { type: string; payload?: unknown }): void {
    // 判断消息是否应该显示给用户
    if (!this.shouldShowMessage(data)) {
      console.log('[GatewayAPI] 🚫 消息已过滤 (子代理/内部消息):', data.type);
      return;
    }

    // 触发消息回调
    if (this.onMessage) {
      const event: GatewayMessageEvent = {
        type: 'message',
        payload: data.payload as GatewayMessageEvent['payload']
      };
      this.onMessage(event);
    }
  }

  /**
   * 判断消息是否应该显示给用户
   */
  private shouldShowMessage(data: { type: string; payload?: unknown }): boolean {
    const { type, payload } = data;

    // 检查是否是子代理相关消息
    if (this.isSubagentMessage(type, payload)) {
      return this.routingConfig.showSubagentMessages;
    }

    // 检查是否是内部消息
    if (this.isInternalMessage(type, payload)) {
      return this.routingConfig.showInternalMessages;
    }

    // 检查是否是调试消息
    if (this.isDebugMessage(type, payload)) {
      return this.routingConfig.showDebugMessages;
    }

    // 默认显示所有其他消息
    return true;
  }

  /**
   * 判断是否是子代理消息
   */
  private isSubagentMessage(type: string, payload: unknown): boolean {
    // 检查消息类型
    if (type.includes('subagent') ||
        type.includes('sub_agent') ||
        type.includes('sub-agent')) {
      return true;
    }

    // 检查 payload 中的标识
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;
      if (p.isSubagent === true ||
          p.source === 'subagent' ||
          p.target === 'subagent' ||
          (typeof p.metadata === 'object' && p.metadata !== null &&
           (p.metadata as Record<string, unknown>).isSubagent === true)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 判断是否是内部消息
   */
  private isInternalMessage(type: string, payload: unknown): boolean {
    // 检查消息类型
    if (type.startsWith('internal.') ||
        type.startsWith('system.')) {
      return true;
    }

    // 检查 payload 中的标识
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;
      if (p.isInternal === true ||
          p.visibility === 'internal' ||
          (typeof p.metadata === 'object' && p.metadata !== null &&
           (p.metadata as Record<string, unknown>).visibility === 'internal')) {
        return true;
      }
    }

    return false;
  }

  /**
   * 判断是否是调试消息
   */
  private isDebugMessage(type: string, _payload: unknown): boolean {
    return type.startsWith('debug.') ||
           type.startsWith('trace.');
  }

  /**
   * 类型守卫：检查是否为消息事件
   */
  private isMessageEvent(data: unknown): data is { type: string; payload?: unknown } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'type' in data &&
      ((data as { type: string }).type === 'message' ||
       (data as { type: string }).type === 'event' ||
       (data as { type: string }).type === 'notification')
    );
  }

  /**
   * 类型守卫：检查是否为认证挑战
   */
  private isConnectChallenge(data: unknown): data is { type: string; payload: unknown } {
    return (
      typeof data === 'object' &&
      data !== null &&
      (('type' in data && (data as { type: string }).type === 'connect.challenge') ||
       ('event' in data && (data as { event: string }).event === 'connect.challenge'))
    );
  }

  /**
   * 提取消息类型（兼容 type/event）
   */
  private getMessageType(data: unknown): string | undefined {
    if (typeof data !== 'object' || data === null) return undefined;
    if ('type' in data && typeof (data as { type?: unknown }).type === 'string') {
      return (data as { type: string }).type;
    }
    if ('event' in data && typeof (data as { event?: unknown }).event === 'string') {
      return (data as { event: string }).event;
    }
    return undefined;
  }

  /**
   * 类型守卫：检查是否为认证成功响应
   */
  private isHelloOk(data: unknown): data is { type: string; payload: { type: string } } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'type' in data &&
      (data as { type: string }).type === 'res' &&
      'payload' in data &&
      typeof (data as { payload: unknown }).payload === 'object' &&
      (data as { payload: { type: string } }).payload !== null &&
      'type' in (data as { payload: { type: string } }).payload &&
      (data as { payload: { type: string } }).payload.type === 'hello-ok'
    );
  }

  /**
   * 类型守卫：检查是否为 API 响应
   */
  private isResponse(
    data: unknown
  ): data is { type: 'res' | 'error'; id: string; payload?: unknown; error?: { message: string } } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'type' in data &&
      ((data as { type: string }).type === 'res' || (data as { type: string }).type === 'error') &&
      'id' in data
    );
  }

  /**
   * 格式化日期为 YYYY-MM-DD 格式
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// 导出单例
const gatewayAPI = new GatewayAPI();
export default gatewayAPI;
export { GatewayAPI };
