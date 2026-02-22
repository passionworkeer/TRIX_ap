/**
 * Clawbot Channel Bridge Service
 * 连接到 Clawbot Channel 云端配对服务
 *
 * 基于文档: docs/PROJECT_SUMMARY.md
 */

import { io, Socket } from 'socket.io-client';
import ossService from './OSSService';
import { supabase } from '../config/supabase';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';

// ✅ #8: 使用 UUID 生成唯一消息 ID
function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export interface ClawbotChannelMessage {
  id?: string;
  content: string;
  contentType: 'text' | 'image' | 'video' | 'file';
  mediaUrl?: string;
  timestamp: number;
  sender: 'user' | 'bot';
}

export interface PairingData {
  pairingCode: string;
  qrImage: string;
  expiresIn: number;
}

type EventCallback = (data: any) => void;

export const CHANNEL_PROTOCOL_MISMATCH = 'CHANNEL_PROTOCOL_MISMATCH';

class ClawbotChannelBridge {
  private socket: Socket | null = null;
  private userId: string | null = null;
  public connected: boolean = false;
  public paired: boolean = false;

  // 配对信息
  private pairingCode: string | null = null;
  private deviceId: string | null = null;

  // 心跳
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongTime: number = Date.now();
  private heartbeatInterval: number = 30000; // 30 秒

  // 重连
  private reconnectAttempts: number = 0;
  private registerTimeout: ReturnType<typeof setTimeout> | null = null;

  // 事件监听器
  private eventListeners: Map<string, Set<EventCallback>> = new Map();

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * 添加事件监听器
   */
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * 移除事件监听器
   */
  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[ClawbotChannel] 事件回调错误 (${event}):`, error);
        }
      });
    }
  }

  /**
   * 移除所有事件监听器
   */
  removeAllListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * 获取或创建设备唯一标识
   */
  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('clawbot_channel_device_id');
    if (!deviceId) {
      deviceId = 'app_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('clawbot_channel_device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * 获取 Supabase User ID
   */
  private async getSupabaseUserId(): Promise<string | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[ClawbotChannel] 获取 session 错误:', error);
        return null;
      }

      if (!session || !session.user) {
        console.warn('[ClawbotChannel] 用户未登录');
        return null;
      }

      return session.user.id;
    } catch (error) {
      console.error('[ClawbotChannel] getSupabaseUserId 错误:', error);
      return null;
    }
  }

  /**
   * 连接到服务器
   */
  async connect(): Promise<void> {
    // 获取用户 ID
    this.userId = await this.getSupabaseUserId();
    if (!this.userId) {
      console.error('[ClawbotChannel] 用户未登录，无法连接');
      this.emit('error', { message: '请先登录' });
      return;
    }

    // 检查是否已配对
    const wasPaired = localStorage.getItem('clawbot_paired') === 'true';
    if (wasPaired) {
      this.paired = true;
      this.deviceId = localStorage.getItem('clawbot_device_id');
    }

    const { channelUrl } = getClawbotEndpoints();
    const serverUrl = channelUrl;

    this.emit('connecting');

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,  // ✅ #13: 降低重连次数（原 100 次）
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000  // ✅ #13: 降低最大延迟（原 60000 秒）
    });

    this.setupEventHandlers();

    // ✅ 修复 1: 移动端前后台切换强制连接检测
    // 解决 iOS Safari 等移动端浏览器冻结 JS 线程导致的"假死"问题
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[ClawbotChannel] 📱 App 切回前台，检查连接...');
        // 强制重置心跳时间，防止刚唤醒就被判定超时断开
        this.lastPongTime = Date.now();

        if (this.socket && this.socket.disconnected) {
          console.log('[ClawbotChannel] 🔄 发现连接断开，立即强制重连');
          this.socket.connect();
        }
      }
    });
  }

  /**
   * 设置 Socket 事件处理
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // 连接成功
    this.socket.on('connect', () => {
      void this.handleConnected();
    });

    // 断开连接
    this.socket.on('disconnect', () => {
      this.connected = false;
      this.stopHeartbeat();
      this.emit('disconnected');
    });

    // 配对成功
    this.socket.on('pairing_success', (data: { deviceId: string; deviceName: string }) => {
      this.paired = true;
      this.deviceId = data.deviceId;
      localStorage.setItem('clawbot_device_id', data.deviceId);
      localStorage.setItem('clawbot_paired', 'true');
      this.emit('paired', data);
    });

    // 收到 Bot 消息
    this.socket.on('bot_message', (msg: {
      content: string;
      contentType?: 'text' | 'image' | 'video' | 'file';
      mediaUrl?: string;
      timestamp: number;
      messageId?: string;
    }) => {
      const message: ClawbotChannelMessage = {
        id: msg.messageId || generateMessageId(),
        content: msg.content,
        contentType: msg.contentType ?? 'text',
        mediaUrl: msg.mediaUrl,
        timestamp: msg.timestamp || Date.now(),
        sender: 'bot'
      };
      this.emit('message', message);
    });

    // Bot 离线通知
    this.socket.on('bot_offline', (data: { deviceId: string; message: string; timestamp: number }) => {
      this.emit('bot_offline', data);
    });

    // Bot 上线通知
    this.socket.on('bot_online', (data: { deviceId: string; message: string; timestamp: number }) => {
      this.emit('bot_online', data);
    });

    // 被解绑
    this.socket.on('unpaired', () => {
      this.paired = false;
      this.deviceId = null;
      localStorage.removeItem('clawbot_paired');
      localStorage.removeItem('clawbot_device_id');
      this.emit('unpaired');
    });

    // 心跳响应
    this.socket.on('pong', () => {
      this.lastPongTime = Date.now();
    });

    // 错误
    this.socket.on('error', (err: any) => {
      console.error('[ClawbotChannel] 错误:', err);
      this.emit('error', this.toErrorPayload(err, '连接错误'));
    });

    // 连接错误
    this.socket.on('connect_error', (err: Error) => {
      console.error('[ClawbotChannel] 连接错误:', err);
      this.reconnectAttempts++;
      this.emit('reconnecting', { attempt: this.reconnectAttempts });
    });
  }

  private toErrorPayload(error: any, fallbackMessage: string): { code?: string; message: string } {
    if (error && typeof error === 'object') {
      return {
        code: error.code,
        message: error.message || fallbackMessage
      };
    }

    if (typeof error === 'string' && error.trim()) {
      return { message: error };
    }

    return { message: fallbackMessage };
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private probePairingStatusAck(timeoutMs: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.userId) {
        reject({
          code: CHANNEL_PROTOCOL_MISMATCH,
          message: 'Channel protocol probe failed: missing socket or user.'
        });
        return;
      }

      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        reject({
          code: CHANNEL_PROTOCOL_MISMATCH,
          message: 'Channel protocol probe timed out: check_pairing_status ACK was not returned.'
        });
      }, timeoutMs);

      this.socket.emit('check_pairing_status', { userId: this.userId }, (response: any) => {
        if (settled) {
          return;
        }

        clearTimeout(timeout);
        settled = true;

        const hasExpectedShape = Boolean(
          response &&
          typeof response === 'object' &&
          (Object.prototype.hasOwnProperty.call(response, 'success') ||
            Object.prototype.hasOwnProperty.call(response, 'paired'))
        );

        if (!hasExpectedShape) {
          reject({
            code: CHANNEL_PROTOCOL_MISMATCH,
            message: 'Channel protocol probe failed: ACK payload format is invalid.'
          });
          return;
        }

        resolve();
      });
    });
  }

  private async handleConnected(): Promise<void> {
    this.connected = true;
    this.reconnectAttempts = 0;
    this.startHeartbeat();

    if (this.registerTimeout) {
      clearTimeout(this.registerTimeout);
    }

    this.registerTimeout = setTimeout(() => {
      if (this.userId) {
        this.socket?.emit('app_register', { userId: this.userId });
      }
    }, 100);

    try {
      // Wait briefly to ensure app_register is flushed before probing protocol capability.
      await this.wait(150);
      await this.probePairingStatusAck(3000);
      this.emit('connected');

      // ✅ 修复 2: 通知 UI 层去 Supabase 拉取断网期间可能遗漏的消息
      // 解决移动端切后台/锁屏期间的消息黑洞问题
      // UI 层应该监听 'sync_missed_messages' 事件并从 Supabase 拉取最新消息
      this.emit('sync_missed_messages');
      console.log('[ClawbotChannel] ✅ 已触发消息同步，UI 层应从 Supabase 拉取遗漏消息');

    } catch (error: any) {
      this.connected = false;
      this.stopHeartbeat();
      this.emit('error', this.toErrorPayload(error, 'Channel protocol mismatch'));
      this.socket?.disconnect();
    }
  }

  // ❌ 已删除: requestPairing() 方法
  // 原因: 服务器没有处理 'request_pairing' 事件
  // 配对流程应由 Clawbot 端发起，不是 App 端

  /**
   * 检查当前用户的服务端配对状态
   */
  checkPairingStatus(): Promise<{
    paired: boolean;
    deviceId?: string;
    deviceName?: string;
    botOnline?: boolean;
    pairedAt?: string;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('未连接到服务器'));
        return;
      }

      if (!this.userId) {
        reject(new Error('用户未登录'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('检查配对状态超时'));
      }, 8000);

      this.socket.emit('check_pairing_status', { userId: this.userId }, (response: any) => {
        clearTimeout(timeout);

        if (!response?.success) {
          this.paired = false;
          this.deviceId = null;
          localStorage.removeItem('clawbot_paired');
          localStorage.removeItem('clawbot_device_id');
          resolve({ paired: false });
          return;
        }

        const data = response.data || response;
        const paired = Boolean(data?.paired);

        if (paired) {
          this.paired = true;
          this.deviceId = data.deviceId || this.deviceId;
          if (this.deviceId) {
            localStorage.setItem('clawbot_device_id', this.deviceId);
          }
          localStorage.setItem('clawbot_paired', 'true');

          resolve({
            paired: true,
            deviceId: data.deviceId,
            deviceName: data.deviceName,
            botOnline: data.botOnline,
            pairedAt: data.pairedAt
          });
          return;
        }

        this.paired = false;
        this.deviceId = null;
        localStorage.removeItem('clawbot_paired');
        localStorage.removeItem('clawbot_device_id');
        resolve({ paired: false });
      });
    });
  }

  /**
   * 通过配对码配对
   */
  pairWithCode(code: string): Promise<{ success: boolean; pairingId?: string; status?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('未连接到服务器'));
        return;
      }

      if (!this.userId) {
        reject(new Error('用户未登录'));
        return;
      }

      this.socket.emit('pair_with_code', { code: code.toUpperCase(), userId: this.userId }, (response: any) => {
        if (response.success) {
          resolve({
            success: true,
            pairingId: response.pairingId,
            status: response.status
          });
        } else {
          reject(new Error(response.error || '配对码无效'));
        }
      });
    });
  }

  /**
   * 通过二维码 Token 配对
   */
  pairWithToken(token: string): Promise<{ success: boolean; pairingId?: string; status?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('未连接到服务器'));
        return;
      }

      if (!this.userId) {
        reject(new Error('用户未登录'));
        return;
      }

      this.socket.emit('pair_with_token', { token, userId: this.userId }, (response: any) => {
        if (response.success) {
          resolve({
            success: true,
            pairingId: response.pairingId,
            status: response.status
          });
        } else {
          reject(new Error(response.error || 'Token 无效'));
        }
      });
    });
  }

  /**
   * ✅ #14: 发送消息到 Clawbot（带确认机制）
   */
  sendMessage(content: string, contentType: 'text' | 'image' | 'video' | 'file' = 'text', mediaUrl?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('[ClawbotChannel] 未连接，无法发送消息'));
        return;
      }

      if (!this.paired) {
        reject(new Error('[ClawbotChannel] 未配对，无法发送消息'));
        return;
      }

      const messageId = generateMessageId();

      // ✅ P0-问题1: 使用 on() + 消息ID匹配，而不是 once()
      // 防止其他消息的确认干扰当前消息
      const timeout = setTimeout(() => {
        // ✅ 清除监听器
        this.socket?.off('message_sent', handler);
        reject(new Error('消息发送超时'));
      }, 10000); // 10 秒超时

      // ✅ 使用 on() 并手动过滤消息ID
      const handler = (response: { success: boolean; messageId?: string; error?: string }) => {
        // ✅ 只处理当前消息的确认
        if (response.messageId === messageId) {
          clearTimeout(timeout);
          this.socket?.off('message_sent', handler); // ✅ 清除监听器

          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || '消息发送失败'));
          }
        }
      };

      this.socket.on('message_sent', handler);

      this.socket.emit('app_message', {
        content,
        contentType,
        mediaUrl,
        messageId // 发送消息ID
      });
    });
  }

  /**
   * 上传媒体文件到 OSS
   */
  async uploadMedia(file: File | Blob): Promise<string> {
    try {
      const result = await ossService.uploadFile(file);
      return result.url;
    } catch (error) {
      console.error('[ClawbotChannel] 文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 解绑
   */
  unpair(): void {
    if (this.socket && this.connected) {
      this.socket.emit('unpair');
    }
    this.paired = false;
    this.deviceId = null;
    this.pairingCode = null;
    localStorage.removeItem('clawbot_paired');
    localStorage.removeItem('clawbot_device_id');
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();
    this.heartbeatTimer = setInterval(() => {
      // 检查是否超过 60 秒没收到 pong
      if (Date.now() - this.lastPongTime > 60000) {
        this.socket?.disconnect();
        this.socket?.connect();
        return;
      }

      this.socket?.emit('ping');
    }, this.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.emit('disconnected');
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null && this.socket.connected;
  }

  /**
   * 检查是否已配对
   */
  isPaired(): boolean {
    return this.paired;
  }

  /**
   * 获取设备 ID
   */
  getDeviceId(): string {
    return this.deviceId || '';
  }

  /**
   * 获取当前配对码
   */
  getPairingCode(): string | null {
    return this.pairingCode;
  }

  /**
   * 获取 User ID
   */
  getUserId(): string | null {
    return this.userId;
  }
}

// 导出单例实例
export const clawbotChannelBridge = new ClawbotChannelBridge();
export default clawbotChannelBridge;
