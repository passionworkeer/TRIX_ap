/**
 * Nanobot Bridge Service (原生 WebSocket 版本)
 * 连接到云端 Nanobot 配对服务
 *
 * 协议文档: docs/CLOUD_SERVER_AND_APP_IMPLEMENTATION.md
 */

import ossService from './OSSService';
import { supabase } from '../config/supabase';

export interface NanobotMessage {
  msg_id?: string;
  message: string;
  message_type: 'text' | 'image' | 'video' | 'file';
  media_url?: string;
  timestamp: string;
  from_device_id?: string;
}

export interface UserInfo {
  device_id: string;
  user_name: string;
  bound_at: string;
}

type EventCallback = (data: any) => void;

class NanobotBridge {
  private ws: WebSocket | null = null;
  private pairingCode: string | null = null;
  public connected: boolean = false;
  private serverUrl: string;
  private deviceId: string;

  // 重连相关
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // 心跳
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval: number = 30000; // 30 秒

  // 浏览器兼容的事件监听器
  private eventListeners: Map<string, Set<EventCallback>> = new Map();

  constructor(serverUrl?: string) {
    // 服务器地址：默认 8766 端口（避免与 clawbot-channel 8765 冲突）
    this.serverUrl = serverUrl || import.meta.env.VITE_NANOBOT_SERVER_URL || 'ws://TRIX_SERVER_HOST:8766';
    this.deviceId = this.getOrCreateDeviceId();
    console.log('[NanobotBridge] 服务器地址:', this.serverUrl);
    console.log('[NanobotBridge] 设备 ID:', this.deviceId);
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
          console.error(`[NanobotBridge] 事件回调错误 (${event}):`, error);
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
    let deviceId = localStorage.getItem('nanobot_device_id');
    if (!deviceId) {
      deviceId = 'app_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('nanobot_device_id', deviceId);
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
        console.error('[NanobotBridge] 获取 session 错误:', error);
        return null;
      }

      if (!session || !session.user) {
        console.warn('[NanobotBridge] 用户未登录');
        return null;
      }

      return session.user.id;
    } catch (error) {
      console.error('[NanobotBridge] getSupabaseUserId 错误:', error);
      return null;
    }
  }

  /**
   * 绑定配对码
   */
  async bindPairingCode(code: string): Promise<{ success: boolean; message: string }> {
    // 先保存配对码
    this.pairingCode = code.toUpperCase();
    localStorage.setItem('nanobot_pairing_code', this.pairingCode);

    // 获取 Supabase User ID
    const userId = await this.getSupabaseUserId();
    if (!userId) {
      console.warn('[NanobotBridge] 未登录，将使用匿名模式');
    }

    // 如果已连接，直接发送配对请求
    if (this.connected && this.ws) {
      this.sendAppPairing(userId || undefined);
      return { success: true, message: '正在配对...' };
    }

    // 否则先连接
    return new Promise((resolve) => {
      const onConnected = () => {
        this.off('connected', onConnected);
        this.off('error', onError);
        this.sendAppPairing(userId || undefined);
        resolve({ success: true, message: '正在配对...' });
      };

      const onError = (error: any) => {
        this.off('connected', onConnected);
        this.off('error', onError);
        resolve({ success: false, message: error.message || '连接失败' });
      };

      this.on('connected', onConnected);
      this.on('error', onError);

      this.connect(code);
    });
  }

  /**
   * 发送配对请求
   */
  private sendAppPairing(userId?: string): void {
    if (!this.ws || !this.pairingCode) return;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const pairingData: any = {
      type: 'app_pairing',
      code: this.pairingCode,
      device_id: this.deviceId,
      client_info: {
        device_name: isMobile ? 'Mobile' : 'Desktop',
        platform: isMobile ? 'mobile' : 'web',
        user_agent: navigator.userAgent
      }
    };

    // 如果有 User ID，添加到请求中
    if (userId) {
      pairingData.user_id = userId;
    }

    this.ws.send(JSON.stringify(pairingData));

    console.log('[NanobotBridge] 发送配对请求:', this.pairingCode, userId ? `(User: ${userId})` : '(匿名)');
  }

  /**
   * 连接到 Nanobot 服务器
   */
  connect(code?: string): void {
    if (code) {
      this.pairingCode = code.toUpperCase();
      localStorage.setItem('nanobot_pairing_code', this.pairingCode);
    }

    if (!this.pairingCode) {
      this.pairingCode = localStorage.getItem('nanobot_pairing_code');
    }

    if (!this.pairingCode) {
      console.error('[NanobotBridge] 没有配对码，无法连接');
      this.emit('error', { message: '没有配对码，请先配对' });
      return;
    }

    // 如果已经连接，直接返回
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[NanobotBridge] 已经连接');
      return;
    }

    // 清理旧连接
    this.cleanup();

    console.log('[NanobotBridge] 正在连接到服务器:', this.serverUrl);
    this.emit('connecting');

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('[NanobotBridge] WebSocket 已连接');
        this.reconnectAttempts = 0;

        // 注册设备
        this.ws!.send(JSON.stringify({
          type: 'register',
          device_id: this.deviceId,
          device_type: 'mobile_app'
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[NanobotBridge] 消息解析错误:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[NanobotBridge] WebSocket 断开:', event.code, event.reason);
        this.connected = false;
        this.stopHeartbeat();
        this.emit('disconnected');

        // 自动重连
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[NanobotBridge] WebSocket 错误:', error);
        this.emit('error', { message: '连接错误' });
      };

    } catch (error) {
      console.error('[NanobotBridge] 创建连接失败:', error);
      this.emit('error', { message: '创建连接失败' });
    }
  }

  /**
   * 处理服务器消息
   */
  private async handleMessage(data: any): Promise<void> {
    const msgType = data.type;

    switch (msgType) {
      case 'register_success':
        console.log('[NanobotBridge] 设备注册成功:', data.device_id);
        // 注册成功后发送配对请求
        if (this.pairingCode) {
          const userId = await this.getSupabaseUserId();
          this.sendAppPairing(userId || undefined);
        }
        break;

      case 'pairing_success':
        console.log('[NanobotBridge] 配对成功:', data);
        this.connected = true;
        this.startHeartbeat();
        this.emit('connected', data);
        break;

      case 'pairing_failed':
        console.error('[NanobotBridge] 配对失败:', data.message);
        this.emit('error', { message: data.message });
        break;

      case 'chat_response':
        // 收到 Nanobot 的回复
        console.log('[NanobotBridge] 收到回复:', data);
        this.emit('message', {
          msg_id: data.msg_id,
          message: data.response,
          message_type: 'text',
          timestamp: data.timestamp
        });
        break;

      case 'error':
        console.error('[NanobotBridge] 服务器错误:', data.message);
        this.emit('error', { message: data.message });
        break;

      case 'pong':
        // 心跳响应
        break;

      default:
        console.log('[NanobotBridge] 未知消息类型:', msgType, data);
    }
  }

  /**
   * 发送消息到 Nanobot
   */
  sendMessage(message: string, messageType: 'text' | 'image' | 'video' | 'file' = 'text', mediaUrl?: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('[NanobotBridge] 未连接，无法发送消息');
    }

    if (!this.pairingCode) {
      throw new Error('[NanobotBridge] 没有配对码');
    }

    const msgId = Date.now().toString();

    const data: any = {
      type: 'chat_message',
      device_id: this.deviceId,
      msg_id: msgId,
      message: message,
      message_type: messageType,
    };

    if (mediaUrl) {
      data.media_url = mediaUrl;
    }

    this.ws.send(JSON.stringify(data));
    console.log('[NanobotBridge] 消息已发送:', msgId);
  }

  /**
   * 上传图片/视频到 OSS
   */
  async uploadMedia(file: File | Blob): Promise<string> {
    try {
      const result = await ossService.uploadFile(file);
      console.log('[NanobotBridge] 文件上传成功:', result.url);
      return result.url;
    } catch (error) {
      console.error('[NanobotBridge] 文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
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
   * 调度重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[NanobotBridge] 重连次数已达上限');
      this.emit('error', { message: '重连次数已达上限' });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * this.reconnectAttempts, 30000);

    console.log(`[NanobotBridge] ${delay / 1000} 秒后重连 (第 ${this.reconnectAttempts} 次)`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 清理连接
   */
  private cleanup(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    console.log('[NanobotBridge] 主动断开连接');
    this.reconnectAttempts = this.maxReconnectAttempts; // 阻止自动重连
    this.cleanup();
    this.connected = false;
    this.emit('disconnected');
  }

  /**
   * 清除配对信息
   */
  clearPairing(): void {
    this.pairingCode = null;
    localStorage.removeItem('nanobot_pairing_code');
    this.disconnect();
    console.log('[NanobotBridge] 配对信息已清除');
  }

  /**
   * 获取当前配对码
   */
  getPairingCode(): string | null {
    return this.pairingCode;
  }

  /**
   * 获取设备 ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// 导出单例实例
export const nanobotBridge = new NanobotBridge();
export default nanobotBridge;
