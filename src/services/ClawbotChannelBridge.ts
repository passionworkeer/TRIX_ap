/**
 * Clawbot Channel Bridge Service
 * Connect to Clawbot Channel backend pairing service
 *
 * Based on: docs/PROJECT_SUMMARY.md
 */

import { io, Socket } from 'socket.io-client';
import ossService from './OSSService';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import type {
  StudyRoomAckPayload,
  StudyRoomHostAction,
  StudyRoomState,
  StudyRoomStateEvent
} from '../types/studyRoom';

/**
 * Generate cryptographically secure random string
 */
function generateSecureRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

// P-#8: Use timestamp + secure random to generate unique message ID
function generateMessageId(): string {
  return `${Date.now()}-${generateSecureRandomString(9)}`;
}

export interface ClawbotChannelMessage {
  id?: string;
  content: string;
  contentType: 'text' | 'image' | 'video' | 'file' | 'mixed';
  mediaUrl?: string;
  mediaMimeType?: string;
  timestamp: number;
  sender: 'user' | 'bot';
}

export interface PairingData {
  pairingCode: string;
  qrImage: string;
  expiresIn: number;
}

/**
 * Socket 事件类型定义
 */
export interface SocketEvents {
  // 连接事件
  connect: void;
  disconnect: void;
  reconnecting: { attempt: number };

  // 配对事件
  pairing_success: { deviceId: string; deviceName: string };
  unpaired: void;

  // 消息事件
  bot_message: {
    content: string;
    contentType?: 'text' | 'image' | 'video' | 'file' | 'mixed';
    mediaUrl?: string;
    mediaMimeType?: string;
    timestamp: number;
  };
  message_sent: { messageId: string; timestamp: number };

  // Bot 状态事件
  bot_online: { deviceId: string; message: string; timestamp: number };
  bot_offline: { deviceId: string; message: string; timestamp: number };

  // 自习室事件
  study_room_state: StudyRoomStateEvent;

  // 错误事件
  error: ErrorPayload;
}

/**
 * Socket 事件名称类型
 */
export type SocketEventName = keyof SocketEvents;

/**
 * Socket 事件 Payload 类型映射
 */
export type SocketEventPayload<T extends SocketEventName> = SocketEvents[T];

/**
 * 错误载荷类型
 */
export interface ErrorPayload {
  code?: string;
  message: string;
}

/**
 * Socket.IO 响应类型
 */
export interface SocketResponse {
  success: boolean;
  paired?: boolean;
  error?: string;
  deviceId?: string;
  deviceName?: string;
  message?: string;
  data?: unknown;
  pairingId?: string;
  status?: string;
}

/**
 * 错误对象类型（用于 Socket.IO 错误处理）
 */
export interface SocketError {
  code?: string;
  message: string;
  description?: string;
  context?: unknown;
}

/**
 * Socket 事件回调类型（使用泛型支持不同事件类型）
 */
type EventCallback<T = unknown> = (data: T) => void;

/**
 * 类型守卫：检查是否为 SocketResponse
 */
function isSocketResponse(data: unknown): data is SocketResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    typeof (data as SocketResponse).success === 'boolean'
  );
}

export const CHANNEL_PROTOCOL_MISMATCH = 'CHANNEL_PROTOCOL_MISMATCH';

class ClawbotChannelBridge {
  private socket: Socket | null = null;
  private userId: string | null = null;
  public connected: boolean = false;
  public paired: boolean = false;

  // Pairing info
  private pairingCode: string | null = null;
  private deviceId: string | null = null;

  // Heartbeat
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongTime: number = Date.now();
  private heartbeatInterval: number = 30000; // 30 seconds

  // Reconnect
  private reconnectAttempts: number = 0;
  private registerTimeout: ReturnType<typeof setTimeout> | null = null;
  private visibilityChangeHandler: (() => void) | null = null;

  // Event listeners
  private eventListeners: Map<string, Set<EventCallback>> = new Map();

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * Add event listener
   */
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit event
   */
  private emit<T extends SocketEventName>(event: T, data?: SocketEventPayload<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.clawbot.error(`[ClawbotChannel] 浜嬩欢鍥炶皟閿欒 (${event}):`, error);
        }
      });
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * Get or create device unique ID
   */
  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('clawbot_channel_device_id');
    if (!deviceId) {
      deviceId = 'app_' + generateSecureRandomString(9) + '_' + Date.now();
      localStorage.setItem('clawbot_channel_device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Get Supabase User ID
   */
  private async getSupabaseUserId(): Promise<string | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        logger.clawbot.error('[ClawbotChannel] Get session error:', error);
        return null;
      }

      if (!session || !session.user) {
        logger.clawbot.warn('[ClawbotChannel] user is not logged in');
        return null;
      }

      return session.user.id;
    } catch (error) {
      logger.clawbot.error('[ClawbotChannel] getSupabaseUserId 閿欒:', error);
      return null;
    }
  }

  /**
   * 杩炴帴鍒版湇鍔″櫒
   */
  async connect(): Promise<void> {
    // Get user ID
    this.userId = await this.getSupabaseUserId();
    if (!this.userId) {
      logger.clawbot.error('[ClawbotChannel] 鐢ㄦ埛鏈櫥褰曪紝鏃犳硶杩炴帴');
      this.emit('error', { message: '璇峰厛鐧诲綍' });
      return;
    }

    // Check if already paired
    const wasPaired = localStorage.getItem('clawbot_paired') === 'true';
    if (wasPaired) {
      this.paired = true;
      this.deviceId = localStorage.getItem('clawbot_device_id');
    }

    const { channelUrl } = getClawbotEndpoints();
    const serverUrl = channelUrl;

    this.emit('connect');

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,  // 鉁?#13: 闄嶄綆閲嶈繛娆℃暟锛堝師 100 娆★級
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000  // 鉁?#13: 闄嶄綆鏈€澶у欢杩燂紙鍘?60000 绉掞級
    });

    this.setupEventHandlers();

    // 移动端前后台切换强制连接检测
    // 解决 iOS Safari 等移动端浏览器冻结 JS 线程导致的"假死"问题
    // 清理旧的监听器（如果有）
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        logger.clawbot.debug('[ClawbotChannel] 🎉 App 切回前台，检查连接...');
        // 强制重置心跳时间，防止刚接收就被判定超时断开
        this.lastPongTime = Date.now();

        if (this.socket && this.socket.disconnected) {
          logger.clawbot.debug('[ClawbotChannel] detected disconnected socket, reconnecting');
          this.socket.connect();
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  }

  /**
   * 璁剧疆 Socket 浜嬩欢澶勭悊
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // 杩炴帴鎴愬姛
    this.socket.on('connect', () => {
      void this.handleConnected();
    });

    // 鏂紑杩炴帴
    this.socket.on('disconnect', () => {
      this.connected = false;
      this.stopHeartbeat();
      this.emit('disconnect');
    });

    // 閰嶅鎴愬姛
    this.socket.on('pairing_success', (data: { deviceId: string; deviceName: string }) => {
      this.paired = true;
      this.deviceId = data.deviceId;
      localStorage.setItem('clawbot_device_id', data.deviceId);
      localStorage.setItem('clawbot_paired', 'true');
      this.emit('pairing_success', data);
    });

    // 鏀跺埌 Bot 娑堟伅
    this.socket.on('bot_message', (msg: {
      content: string;
      contentType?: 'text' | 'image' | 'video' | 'file' | 'mixed';
      mediaUrl?: string;
      mediaMimeType?: string;
      media_mime_type?: string;
      timestamp: number;
      messageId?: string;
    }) => {
      const message: ClawbotChannelMessage = {
        id: msg.messageId || generateMessageId(),
        content: msg.content,
        contentType: msg.contentType ?? 'text',
        mediaUrl: msg.mediaUrl,
        mediaMimeType: msg.mediaMimeType ?? msg.media_mime_type,
        timestamp: msg.timestamp || Date.now(),
        sender: 'bot'
      };
      this.emit('bot_message', message);
    });

    // Bot 绂荤嚎閫氱煡
    this.socket.on('bot_offline', (data: { deviceId: string; message: string; timestamp: number }) => {
      this.emit('bot_offline', data);
    });

    // Bot 涓婄嚎閫氱煡
    this.socket.on('bot_online', (data: { deviceId: string; message: string; timestamp: number }) => {
      this.emit('bot_online', data);
    });

    // 琚В缁?
    this.socket.on('unpaired', () => {
      this.paired = false;
      this.deviceId = null;
      localStorage.removeItem('clawbot_paired');
      localStorage.removeItem('clawbot_device_id');
      this.emit('unpaired');
    });

    this.socket.on('study_room_state', (payload: StudyRoomStateEvent) => {
      this.emit('study_room_state', payload);
    });

    // 蹇冭烦鍝嶅簲
    this.socket.on('pong', () => {
      this.lastPongTime = Date.now();
    });

    // 閿欒
    this.socket.on('error', (err: unknown) => {
      logger.clawbot.error('[ClawbotChannel] 閿欒:', err);
      this.emit('error', this.toErrorPayload(err, '杩炴帴閿欒'));
    });

    // 杩炴帴閿欒
    this.socket.on('connect_error', (err: Error) => {
      logger.clawbot.error('[ClawbotChannel] 杩炴帴閿欒:', err);
      this.reconnectAttempts++;
      this.emit('reconnecting', { attempt: this.reconnectAttempts });
    });
  }

  private toErrorPayload(error: unknown, fallbackMessage: string): ErrorPayload {
    if (error && typeof error === 'object') {
      const err = error as Partial<SocketError>;
      return {
        code: err.code,
        message: err.message || fallbackMessage
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

      this.socket.emit('check_pairing_status', { userId: this.userId }, (response: unknown) => {
        if (settled) {
          return;
        }

        clearTimeout(timeout);
        settled = true;

        if (!isSocketResponse(response)) {
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
      this.emit('connect');

      // 鉁?淇 2: 閫氱煡 UI 灞傚幓 Supabase 鎷夊彇鏂綉鏈熼棿鍙兘閬楁紡鐨勬秷鎭?
      // 瑙ｅ喅绉诲姩绔垏鍚庡彴/閿佸睆鏈熼棿鐨勬秷鎭粦娲為棶棰?
      // UI 灞傚簲璇ョ洃鍚?'sync_missed_messages' 浜嬩欢骞朵粠 Supabase 鎷夊彇鏈€鏂版秷鎭?
      // UI 层应监听 'sync_missed_messages' 事件并从 Supabase 拉取最新消息
      logger.clawbot.debug('[ClawbotChannel] ✅ 已触发消息同步，UI 层应从 Supabase 拉取遗漏消息');

    } catch (error: unknown) {
      this.connected = false;
      this.stopHeartbeat();
      this.emit('error', this.toErrorPayload(error, 'Channel protocol mismatch'));
      this.socket?.disconnect();
    }
  }

  // 鉂?宸插垹闄? requestPairing() 鏂规硶
  // 鍘熷洜: 鏈嶅姟鍣ㄦ病鏈夊鐞?'request_pairing' 浜嬩欢
  // 閰嶅娴佺▼搴旂敱 Clawbot 绔彂璧凤紝涓嶆槸 App 绔?

  /**
   * Check current user's server-side pairing status
   */
  private emitWithAck<T extends { success?: boolean; error?: string }>(
    event: string,
    payload: Record<string, unknown>,
    timeoutMs = 10000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected to channel server'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`${event} timeout`));
      }, timeoutMs);

      this.socket.emit(event, payload, (response: T | undefined) => {
        clearTimeout(timeout);

        if (!response || typeof response !== 'object') {
          reject(new Error(`${event} invalid ACK payload`));
          return;
        }

        resolve(response);
      });
    });
  }

  checkPairingStatus(): Promise<{
    paired: boolean;
    deviceId?: string;
    deviceName?: string;
    botOnline?: boolean;
    pairedAt?: string;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected to channel server'));
        return;
      }

      if (!this.userId) {
        reject(new Error('User not logged in'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('check_pairing_status timeout'));
      }, 8000);

      this.socket.emit('check_pairing_status', { userId: this.userId }, (response: unknown) => {
        clearTimeout(timeout);

        if (!isSocketResponse(response) || !response.success) {
          this.paired = false;
          this.deviceId = null;
          localStorage.removeItem('clawbot_paired');
          localStorage.removeItem('clawbot_device_id');
          resolve({ paired: false });
          return;
        }

        const data = (response.data || response) as {
          paired?: boolean;
          deviceId?: string;
          deviceName?: string;
          botOnline?: boolean;
          pairedAt?: string;
        };
        const paired = Boolean((data as { paired?: boolean })?.paired);

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
   * Pair via pairing code
   */
  pairWithCode(code: string): Promise<{ success: boolean; pairingId?: string; status?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected to channel server'));
        return;
      }

      if (!this.userId) {
        reject(new Error('User not logged in'));
        return;
      }

      this.socket.emit('pair_with_code', { code: code.toUpperCase(), userId: this.userId }, (response: unknown) => {
        if (!isSocketResponse(response)) {
          reject(new Error('Invalid response from server'));
          return;
        }

        if (response.success) {
          resolve({
            success: true,
            pairingId: response.pairingId,
            status: response.status
          });
        } else {
          reject(new Error(response.error || 'Invalid pairing code'));
        }
      });
    });
  }

  /**
   * Pair via QR code token
   */
  pairWithToken(token: string): Promise<{ success: boolean; pairingId?: string; status?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected to channel server'));
        return;
      }

      if (!this.userId) {
        reject(new Error('User not logged in'));
        return;
      }

      this.socket.emit('pair_with_token', { token, userId: this.userId }, (response: unknown) => {
        if (!isSocketResponse(response)) {
          reject(new Error('Invalid response from server'));
          return;
        }

        if (response.success) {
          resolve({
            success: true,
            pairingId: response.pairingId,
            status: response.status
          });
        } else {
          reject(new Error(response.error || 'Invalid pairing token'));
        }
      });
    });
  }

  /**
   * 鉁?#14: 鍙戦€佹秷鎭埌 Clawbot锛堝甫纭鏈哄埗锛?
   */
  async createStudyRoom(
    displayName: string,
    avatarUrl?: string,
    maxMembers?: number
  ): Promise<StudyRoomState> {
    if (!this.userId) {
      throw new Error('User not logged in');
    }

    const response = await this.emitWithAck<StudyRoomAckPayload>(
      'study_room_create',
      {
        userId: this.userId,
        displayName,
        avatarUrl,
        maxMembers
      },
      10000
    );

    if (!response.success || !response.room) {
      throw new Error(response.error || 'Create study room failed');
    }

    return response.room;
  }

  async joinStudyRoom(
    roomCode: string,
    displayName: string,
    avatarUrl?: string
  ): Promise<StudyRoomState> {
    if (!this.userId) {
      throw new Error('User not logged in');
    }

    const response = await this.emitWithAck<StudyRoomAckPayload>(
      'study_room_join',
      {
        userId: this.userId,
        roomCode,
        displayName,
        avatarUrl
      },
      10000
    );

    if (!response.success || !response.room) {
      throw new Error(response.error || 'Join study room failed');
    }

    return response.room;
  }

  async leaveStudyRoom(roomCode?: string): Promise<void> {
    if (!this.userId) {
      throw new Error('User not logged in');
    }

    const response = await this.emitWithAck<StudyRoomAckPayload>(
      'study_room_leave',
      {
        userId: this.userId,
        roomCode
      },
      10000
    );

    if (!response.success) {
      throw new Error(response.error || 'Leave study room failed');
    }
  }

  async hostActionStudyRoom(roomCode: string, action: StudyRoomHostAction): Promise<StudyRoomState> {
    if (!this.userId) {
      throw new Error('User not logged in');
    }

    const response = await this.emitWithAck<StudyRoomAckPayload>(
      'study_room_host_action',
      {
        userId: this.userId,
        roomCode,
        action
      },
      10000
    );

    if (!response.success || !response.room) {
      throw new Error(response.error || 'Host action failed');
    }

    return response.room;
  }

  async getStudyRoomState(roomCode?: string): Promise<StudyRoomState> {
    if (!this.userId) {
      throw new Error('User not logged in');
    }

    const response = await this.emitWithAck<StudyRoomAckPayload>(
      'study_room_get_state',
      {
        userId: this.userId,
        roomCode
      },
      10000
    );

    if (!response.success || !response.room) {
      throw new Error(response.error || 'Get study room state failed');
    }

    return response.room;
  }

  sendMessage(
    content: string,
    contentType: 'text' | 'image' | 'video' | 'file' | 'mixed' = 'text',
    mediaUrl?: string,
    mediaMimeType?: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('[ClawbotChannel] not connected, cannot send message'));
        return;
      }

      if (!this.paired) {
        reject(new Error('[ClawbotChannel] not paired, cannot send message'));
        return;
      }

      const messageId = generateMessageId();

      // 鉁?P0-闂1: 浣跨敤 on() + 娑堟伅ID鍖归厤锛岃€屼笉鏄?once()
      // 闃叉鍏朵粬娑堟伅鐨勭‘璁ゅ共鎵板綋鍓嶆秷鎭?
      const timeout = setTimeout(() => {
        // 鉁?娓呴櫎鐩戝惉鍣?
        this.socket?.off('message_sent', handler);
        reject(new Error('message_sent timeout'));
      }, 10000); // 10 绉掕秴鏃?

      // 鉁?浣跨敤 on() 骞舵墜鍔ㄨ繃婊ゆ秷鎭疘D
      const handler = (response: { success: boolean; messageId?: string; error?: string }) => {
        // 鉁?鍙鐞嗗綋鍓嶆秷鎭殑纭
        if (response.messageId === messageId) {
          clearTimeout(timeout);
          this.socket?.off('message_sent', handler); // 鉁?娓呴櫎鐩戝惉鍣?

          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || 'Failed to send message'));
          }
        }
      };

      this.socket.on('message_sent', handler);

      this.socket.emit('app_message', {
        content,
        contentType,
        mediaUrl,
        mediaMimeType,
        messageId // 鍙戦€佹秷鎭疘D
      });
    });
  }

  /**
   * Upload media file to OSS
   */
  async uploadMedia(file: File | Blob): Promise<string> {
    try {
      const result = await ossService.uploadFile(file);
      return result.url;
    } catch (error) {
      logger.clawbot.error('[ClawbotChannel] File upload failed:', error);
      throw error;
    }
  }

  /**
   * 瑙ｇ粦
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
   * 鍚姩蹇冭烦
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastPongTime = Date.now();
    this.heartbeatTimer = setInterval(() => {
      // Check if timed out without receiving pong for over 60 seconds
      if (Date.now() - this.lastPongTime > 60000) {
        this.socket?.disconnect();
        this.socket?.connect();
        return;
      }

      this.socket?.emit('ping');
    }, this.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 鏂紑杩炴帴
   */
  disconnect(): void {
    this.stopHeartbeat();

    // 清理 visibilitychange 监听器，防止内存泄漏
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.emit('disconnect');
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected && this.socket !== null && this.socket.connected;
  }

  /**
   * Check if paired
   */
  isPaired(): boolean {
    return this.paired;
  }

  /**
   * Get device ID
   */
  getDeviceId(): string {
    return this.deviceId || '';
  }

  /**
   * Get current pairing code
   */
  getPairingCode(): string | null {
    return this.pairingCode;
  }

  /**
   * Get User ID
   */
  getUserId(): string | null {
    return this.userId;
  }
}

// Export singleton instance
export const clawbotChannelBridge = new ClawbotChannelBridge();
export default clawbotChannelBridge;


