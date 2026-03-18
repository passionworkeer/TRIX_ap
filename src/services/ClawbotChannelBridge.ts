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
  StudyRoomStateEvent,
  FriendRoomLookupResult
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

export interface ClawbotChannelAttachment {
  id?: string;
  kind: 'image' | 'audio' | 'video' | 'file';
  url: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ClawbotChannelMessage {
  id?: string;
  content: string;
  contentType: 'text' | 'image' | 'video' | 'file' | 'mixed' | 'voice';
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    originalName?: string;
    size?: number;
    [key: string]: unknown;
  };
  attachments?: ClawbotChannelAttachment[];
  metadata?: Record<string, unknown>;
  timestamp: number;
  sender: 'user' | 'bot';
}
export interface PairingData {
  pairingCode: string;
  qrImage: string;
  expiresIn: number;
}

/**
 * Socket �¼����Ͷ���
 */
export interface SocketEvents {
  // �����¼�
  connect: void;
  connected: void;
  disconnect: void;
  reconnecting: { attempt: number };

  // ����¼�
  pairing_success: { deviceId: string; deviceName: string };
  unpaired: void;

  // ��Ϣ�¼�
  bot_message: {
    content: string;
    contentType?: 'text' | 'image' | 'video' | 'file' | 'mixed' | 'voice';
    mediaUrl?: string;
    mediaMimeType?: string;
    mediaMetadata?: ClawbotChannelMessage['mediaMetadata'];
    timestamp: number;
  };
  message_sent: { messageId: string; timestamp: number };

  // Bot ״̬�¼�
  bot_online: { deviceId: string; message: string; timestamp: number };
  bot_offline: { deviceId: string; message: string; timestamp: number };

  // ��ϰ���¼�
  study_room_state: StudyRoomStateEvent;

  // �����¼�
  error: ErrorPayload;
}

/**
 * Socket �¼���������
 */
export type SocketEventName = keyof SocketEvents;

/**
 * Socket �¼� Payload ����ӳ��
 */
export type SocketEventPayload<T extends SocketEventName> = SocketEvents[T];

/**
 * �����غ�����
 */
export interface ErrorPayload {
  code?: string;
  message: string;
}

/**
 * Socket.IO ��Ӧ����
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
 * ����������ͣ����� Socket.IO ��������
 */
export interface SocketError {
  code?: string;
  message: string;
  description?: string;
  context?: unknown;
}

/**
 * OpenClaw ������������
 */
export type OpenClawControlAction =
  | 'models_status'
  | 'skills_list'
  | 'skills_check'
  | 'cron_list'
  | 'cron_add'
  | 'cron_enable'
  | 'cron_disable'
  | 'cron_remove'
  | 'cron_run'
  | 'status'
  | 'health'
  | 'doctor'
  | 'doctor_repair'
  | 'logs'
  | 'config_backup'
  | 'config_rollback'
  | 'config_backup_info';

/**
 * �����������
 */
export interface ControlCommandParams {
  // cron ���
  name?: string;
  schedule?: string;
  type?: 'message' | 'system-event';
  content?: string;
  channel?: string;
  to?: string;
  jobId?: string;

  // logs ���
  limit?: number;
}

/**
 * ����������Ӧ
 */
export interface ControlCommandResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Socket �¼��ص����ͣ�ʹ�÷���֧�ֲ�ͬ�¼����ͣ�
 */
type EventCallback<T = unknown> = (data: T) => void;

/**
 * ��������������Ƿ�Ϊ SocketResponse
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
          logger.clawbot.error(`[ClawbotChannel] �¼��ص����� (${event}):`, error);
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
      logger.clawbot.error('[ClawbotChannel] getSupabaseUserId ����:', error);
      return null;
    }
  }

  /**
   * ���ӵ�������
   */
  async connect(): Promise<void> {
    // Get user ID
    this.userId = await this.getSupabaseUserId();
    if (!this.userId) {
      logger.clawbot.error('[ClawbotChannel] �û�δ��¼���޷�����');
      this.emit('error', { message: '���ȵ�¼' });
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

    this.emit('connected');

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,  // ��������������ԭ 100 �Σ�
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000  // ��������ӳ٣�ԭ�� 60000 ���룩
    });

    this.setupEventHandlers();

    // �ƶ���ǰ��̨�л�ǿ�����Ӽ��
    // ��� iOS Safari ���ƶ������������ JS �̵߳��µ�"����"����
    // �����ɵļ�����������У�
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }

    this.visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible') {
        logger.clawbot.debug('[ClawbotChannel] ?? App �л�ǰ̨���������...');
        // ǿ����������ʱ�䣬��ֹ�ս��վͱ��ж���ʱ�Ͽ�
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
   * 设置 Socket 事件处理
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // ���ӳɹ�
    this.socket.on('connect', () => {
      void this.handleConnected();
    });

    // �Ͽ�����
    this.socket.on('disconnect', () => {
      this.connected = false;
      this.stopHeartbeat();
      this.emit('disconnect');
    });

    // ���������� Clawbot �˷���
    this.socket.on('pairing_success', (data: { deviceId: string; deviceName: string }) => {
      this.paired = true;
      this.deviceId = data.deviceId;
      localStorage.setItem('clawbot_device_id', data.deviceId);
      localStorage.setItem('clawbot_paired', 'true');
      this.emit('pairing_success', data);
    });

    // 收到 Bot 消息
    this.socket.on('bot_message', (msg: {
      content: string;
      contentType?: 'text' | 'image' | 'video' | 'file' | 'mixed' | 'voice';
      mediaUrl?: string;
      mediaMimeType?: string;
      media_mime_type?: string;
      mediaMetadata?: ClawbotChannelMessage['mediaMetadata'];
      media_metadata?: ClawbotChannelMessage['mediaMetadata'];
      attachmentName?: string;
      attachment_name?: string;
      attachmentSize?: number;
      attachment_size?: number;
      timestamp: number;
      messageId?: string;
    }) => {
      const normalizedMediaMetadata = msg.mediaMetadata ?? msg.media_metadata ?? {
        originalName: msg.attachmentName ?? msg.attachment_name,
        size: msg.attachmentSize ?? msg.attachment_size,
      };

      const message: ClawbotChannelMessage = {
        id: msg.messageId || generateMessageId(),
        content: msg.content,
        contentType: msg.contentType ?? 'text',
        mediaUrl: msg.mediaUrl,
        mediaMimeType: msg.mediaMimeType ?? msg.media_mime_type,
        mediaMetadata: normalizedMediaMetadata,
        timestamp: msg.timestamp || Date.now(),
        sender: 'bot'
      };
      this.emit('bot_message', message);
      (this.emit as any)('message', message); // ����ǰ�˼��� 'message' �¼�
    });

    // Bot ����֪ͨ
    this.socket.on('bot_offline', (data: { deviceId: string; message: string; timestamp: number }) => {
      this.emit('bot_offline', data);
    });

    // Bot ����֪ͨ
    this.socket.on('bot_online', (data: { deviceId: string; message: string; timestamp: number }) => {
      this.emit('bot_online', data);
    });

    // 被解�?
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

    // 心跳响应
    this.socket.on('pong', () => {
      this.lastPongTime = Date.now();
    });

    // ����
    this.socket.on('error', (err: unknown) => {
      logger.clawbot.error('[ClawbotChannel] ����:', err);
      this.emit('error', this.toErrorPayload(err, '���Ӵ���'));
    });

    // ���Ӵ���
    this.socket.on('connect_error', (err: Error) => {
      logger.clawbot.error('[ClawbotChannel] ���Ӵ���:', err);
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
      this.emit('connected');

      // �޸� 2: ֪ͨ UI ��ȥ Supabase ��ȡ�������ܷ��͵���Ϣ
      // ����ƶ����к�̨/�����ڼ����Ϣ��������
      // UI ��Ӧ����
      // UI ��Ӧ���� 'sync_missed_messages' �¼����� Supabase ��ȡ������Ϣ
      logger.clawbot.debug('[ClawbotChannel] ? �Ѵ�����Ϣͬ����UI ��Ӧ�� Supabase ��ȡ��©��Ϣ');

    } catch (error: unknown) {
      this.connected = false;
      this.stopHeartbeat();
      this.emit('error', this.toErrorPayload(error, 'Channel protocol mismatch'));
      this.socket?.disconnect();
    }
  }

  // �?��ɾ�� requestPairing() ����
  // ԭ��: ������û�д���
  // ���������� Clawbot �˷���

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
   * #14: ������Ϣ�� Clawbot����ȷ�ϻ��ƣ�
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

  /**
   * ������ѯ����û�����ϰ��״̬
   * ע�⣺���ڷ��������ܲ�֧��������ѯ������ʹ��ѭ�����õ�����ѯ
   */
  async lookupStudyRoomsByUsers(userIds: string[]): Promise<{ users: FriendRoomLookupResult[] }> {
    const results: FriendRoomLookupResult[] = [];

    // �����û���ѯ������������������ӿڿ����Ż���
    for (const userId of userIds) {
      try {
        // ���Ի�ȡ�û������ķ���״̬��ͨ����ѯ���ܵķ��䣩
        // ����û��ֱ�ӵ� API�����ﷵ��Ĭ��״̬
        results.push({
          userId,
          inRoom: false,
          roomCode: undefined,
          sessionState: undefined,
          memberCount: undefined
        });
      } catch (error) {
        logger.debug('ClawbotChannel', 'Failed to check user room status:', error);
        results.push({
          userId,
          inRoom: false,
          roomCode: undefined,
          sessionState: undefined,
          memberCount: undefined
        });
      }
    }

    return { users: results };
  }

  sendMessage(
    content: string,
    contentType: 'text' | 'image' | 'video' | 'file' | 'mixed' = 'text',
    mediaUrl?: string,
    mediaMimeType?: string,
    mediaMetadata?: ClawbotChannelMessage['mediaMetadata']
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

      // ֱ�ӷ�����Ϣ�����ȴ�ȷ��
      this.socket.emit('app_message', {
        content,
        contentType,
        mediaUrl,
        mediaMimeType,
        mediaMetadata,
        messageId
      });

      // ֱ�ӷ��سɹ�
      resolve();
    });
  }

  /**
   * ���Ϳ������ OpenClaw
   */
  async sendControlCommand<T = unknown>(
    action: string,
    params?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('[ClawbotChannel] not connected, cannot send command'));
        return;
      }

      if (!this.paired) {
        reject(new Error('[ClawbotChannel] not paired, cannot send command'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('control_command timeout'));
      }, 60000); // 60 �볬ʱ

      this.socket.emit('control_command', { action, params }, (response: { success: boolean; data?: T; error?: string }) => {
        clearTimeout(timeout);
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Command failed'));
        }
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
   * ��绑
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
   * �Ͽ�����
   */
  disconnect(): void {
    this.stopHeartbeat();

    // ���� visibilitychange ����������ֹ�ڴ�й©
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





