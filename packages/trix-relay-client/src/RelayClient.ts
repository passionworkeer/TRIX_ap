/**
 * RelayClient - WebSocket client for Relay Server
 *
 * Connection through relay server to reach OpenClaw Gateway
 */

import {
  createReqFrame,
  parseFrame,
  isEvtFrame,
  isResFrame,
  serializeFrame,
} from './protocol.js';
import type {
  RelayOptions,
  EventHandler,
} from './types.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface RequestFrame {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export class RelayClient {
  private ws: WebSocket | null = null;
  private serverUrl: string | null = null;
  private gatewayId: string | null = null;
  private accessCode: string | null = null;
  private connected = false;
  private authenticated = false;
  private eventListeners = new Map<string, Set<EventHandler>>();
  private pendingRequests = new Map<string, PendingRequest>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private stopped = false;
  private messageQueue: RequestFrame[] = [];
  private deviceInfo: { gatewayId: string; displayName?: string } | null = null;

  constructor() {}

  /**
   * Connect to relay server
   */
  async connect(options: RelayOptions): Promise<void> {
    const { server, gatewayId, accessCode } = options;

    // Convert http/https to ws/wss
    this.serverUrl = server.replace(/^http/, 'ws') + '/relay';
    this.gatewayId = gatewayId;
    this.accessCode = accessCode;
    this.stopped = false;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl!);

        this.ws.onopen = () => {
          this.connected = true;
          this.authenticate(gatewayId, accessCode)
            .then((deviceInfo) => {
              this.deviceInfo = deviceInfo;
              this.authenticated = true;
              this.reconnectAttempts = 0;
              this.emit('authenticated', deviceInfo);
              this.flushMessageQueue();
              resolve();
            })
            .catch((error) => {
              this.authenticated = false;
              this.ws?.close();
              reject(error);
            });
        };

        this.ws.onmessage = (event) => {
          const raw = typeof event.data === 'string' ? event.data : event.data.toString();
          this.handleMessage(raw);
        };

        this.ws.onclose = (event) => {
          this.connected = false;
          this.authenticated = false;
          this.emit('disconnect', event.reason || `code ${event.code}`);

          if (!this.stopped && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
        };

        // Connection timeout
        setTimeout(() => {
          if (!this.connected) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Authenticate with relay server
   */
  private async authenticate(
    gatewayId: string,
    accessCode: string
  ): Promise<{ gatewayId: string; displayName?: string }> {
    const method = 'relay.auth';
    const params = { gatewayId, accessCode };

    const result = await this.request<{
      ok: boolean;
      device?: { gatewayId: string; displayName?: string };
      error?: string;
    }>(method, params);

    if (!result.ok) {
      throw new Error(result.error || 'Authentication failed');
    }

    return result.device!;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(raw: string): void {
    const frame = parseFrame(raw);
    if (!frame) return;

    // Event frame
    if (isEvtFrame(frame)) {
      // Handle device message
      if (frame.event === 'from_device') {
        this.emit('from_device', frame.payload);
        return;
      }

      // Handle gateway status
      if (frame.event === 'gateway_status') {
        this.emit('gateway_status', frame.payload);
        return;
      }

      // Forward other events
      this.emit(frame.event, frame.payload ?? null);
      return;
    }

    // Response frame
    if (isResFrame(frame)) {
      const pending = this.pendingRequests.get(frame.id);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(frame.id);

        if (frame.ok) {
          pending.resolve(frame.payload);
        } else {
          pending.reject(new Error(frame.error?.message ?? 'relay error'));
        }
      }
    }
  }

  /**
   * Send request and wait for response
   */
  private request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Not connected'));
    }

    const frame = createReqFrame(method, params);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(frame.id);
        reject(new Error(`Request ${method} timeout`));
      }, 30000);

      this.pendingRequests.set(frame.id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
      this.ws!.send(serializeFrame(frame));
    });
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const frame = this.messageQueue.shift() as RequestFrame;
      if (frame && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(serializeFrame(frame));
      } else if (frame) {
        this.messageQueue.unshift(frame);
        break;
      }
    }
  }

  /**
   * Schedule reconnect
   */
  private scheduleReconnect(): void {
    if (this.stopped || !this.serverUrl) return;

    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    this.reconnectAttempts++;

    setTimeout(() => {
      if (!this.stopped && this.gatewayId && this.accessCode) {
        this.connect({
          server: this.serverUrl!.replace('/relay', ''),
          gatewayId: this.gatewayId,
          accessCode: this.accessCode,
        })
          .then(() => {})
          .catch(() => {});
      }
    }, delay);
  }

  /**
   * Send message to device
   */
  async sendToDevice(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.authenticated) {
      throw new Error('Not authenticated');
    }

    const result = await this.request<{ ok: boolean; error?: string }>(
      'relay.to_device',
      { method, params }
    );

    if (!result.ok) {
      throw new Error(result.error || 'Send failed');
    }
  }

  /**
   * Request connection to device Gateway
   */
  async connectGateway(): Promise<void> {
    if (!this.authenticated) {
      throw new Error('Not authenticated');
    }

    const result = await this.request<{ ok: boolean; error?: string }>(
      'relay.connect_gateway',
      {}
    );

    if (!result.ok) {
      throw new Error(result.error || 'Connect gateway failed');
    }
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.stopped = true;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.authenticated = false;
    this.eventListeners.clear();

    for (const [_, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('relay client stopped'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  /**
   * Get Gateway ID
   */
  getGatewayId(): string | null {
    return this.gatewayId;
  }

  /**
   * Get device info
   */
  getDeviceInfo(): { gatewayId: string; displayName?: string } | null {
    return this.deviceInfo;
  }

  // ============================================
  // Event Handling
  // ============================================

  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler as EventHandler);
  }

  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  private emit<T = unknown>(event: string, data?: T): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[RelayClient] Event handler error (${event}):`, error);
        }
      });
    }
  }
}
