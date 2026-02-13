/**
 * Nanobot Bridge Service
 * 连接到云端 Nanobot 配对服务
 */

import { io, Socket } from 'socket.io-client';
import ossService from './OSSService';

export interface NanobotMessage {
  code: string;
  message: string;
  message_type: 'text' | 'image' | 'video' | 'file';
  media_url?: string;
  timestamp: string;
}

export interface UserInfo {
  device_id: string;
  user_name: string;
  bound_at: string;
}

type EventCallback = (data: any) => void;

class NanobotBridge {
  private socket: Socket | null = null;
  private pairingCode: string | null = null;
  public connected: boolean = false;
  private serverUrl: string;
  private deviceId: string;

  // 浏览器兼容的事件监听器
  private eventListeners: Map<string, Set<EventCallback>> = new Map();

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl || import.meta.env.VITE_NANOBOT_SERVER_URL || 'http://localhost:5001';
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
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
      localStorage.setItem('nanobot_device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * 生成配对码（需要先调用服务端 API）
   */
  async generatePairingCode(): Promise<string> {
    try {
      const response = await fetch(`${this.serverUrl}/api/pairing/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        console.log('[NanobotBridge] 生成配对码:', data.code);
        return data.code;
      } else {
        throw new Error(data.error || '生成配对码失败');
      }
    } catch (error) {
      console.error('[NanobotBridge] 生成配对码失败:', error);
      throw error;
    }
  }

  /**
   * 绑定配对码
   */
  async bindPairingCode(code: string, userName?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.serverUrl}/api/pairing/${code}/bind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: this.deviceId,
          user_name: userName || 'TRIX User',
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('[NanobotBridge] 配对码绑定成功');
        this.pairingCode = code;
        localStorage.setItem('nanobot_pairing_code', code);
      }

      return data;
    } catch (error) {
      console.error('[NanobotBridge] 绑定配对码失败:', error);
      throw error;
    }
  }

  /**
   * 连接到 Nanobot 服务器
   */
  connect(code?: string): void {
    if (code) {
      this.pairingCode = code;
    }

    if (!this.pairingCode) {
      // 尝试从 localStorage 恢复
      this.pairingCode = localStorage.getItem('nanobot_pairing_code');
    }

    if (!this.pairingCode) {
      console.error('[NanobotBridge] 没有配对码，无法连接');
      this.emit('error', { message: '没有配对码，请先配对' });
      return;
    }

    console.log('[NanobotBridge] 正在连接到服务器:', this.serverUrl);

    // 创建 Socket.IO 连接
    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 30000,
    });

    // 连接成功
    this.socket.on('connect', () => {
      console.log('[NanobotBridge] WebSocket 已连接');
      this.connected = true;

      // 注册为 App 客户端
      this.socket!.emit('register_app', {
        code: this.pairingCode,
        client_type: 'app',
        device_id: this.deviceId,
      });
    });

    // 注册成功
    this.socket.on('registered', (data: any) => {
      if (data.success) {
        console.log('[NanobotBridge] 注册成功:', data);
        this.emit('connected', data);
      } else {
        console.error('[NanobotBridge] 注册失败:', data);
        this.emit('error', data);
      }
    });

    // 收到 Nanobot 消息
    this.socket.on('message_to_app', (data: NanobotMessage) => {
      console.log('[NanobotBridge] 收到 Nanobot 消息:', data);
      this.emit('message', data);
    });

    // 断开连接
    this.socket.on('disconnect', () => {
      console.log('[NanobotBridge] WebSocket 断开');
      this.connected = false;
      this.emit('disconnected');
    });

    // 错误处理
    this.socket.on('error', (error: any) => {
      console.error('[NanobotBridge] WebSocket 错误:', error);
      this.emit('error', error);
    });

    // 重连中
    this.socket.io.on('reconnect_attempt', (attempt: number) => {
      console.log(`[NanobotBridge] 重连尝试 ${attempt}`);
      this.emit('reconnecting', { attempt });
    });

    // 重连成功
    this.socket.io.on('reconnect', (attempt: number) => {
      console.log(`[NanobotBridge] 重连成功 (第${attempt}次)`);
      this.emit('reconnected', { attempt });
    });
  }

  /**
   * 发送消息到 Nanobot
   */
  sendMessage(message: string, messageType: 'text' | 'image' | 'video' | 'file' = 'text', mediaUrl?: string): void {
    if (!this.connected || !this.socket) {
      throw new Error('[NanobotBridge] 未连接，无法发送消息');
    }

    if (!this.pairingCode) {
      throw new Error('[NanobotBridge] 没有配对码');
    }

    const data: NanobotMessage = {
      code: this.pairingCode,
      message,
      message_type: messageType,
      media_url: mediaUrl,
      timestamp: new Date().toISOString(),
    };

    this.socket.emit('message_from_app', data);
    console.log('[NanobotBridge] 消息已发送:', data);
  }

  /**
   * 上传图片/视频到 OSS
   */
  async uploadMedia(file: File | Blob): Promise<string> {
    try {
      // 使用阿里云 OSS 上传
      const url = await ossService.uploadFile(file);
      console.log('[NanobotBridge] 文件上传成功:', url);
      return url;
    } catch (error) {
      console.error('[NanobotBridge] 文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      console.log('[NanobotBridge] 已断开连接');
    }
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
   * 获取设备ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }
}

// 导出单例实例
export const nanobotBridge = new NanobotBridge();
export default nanobotBridge;
