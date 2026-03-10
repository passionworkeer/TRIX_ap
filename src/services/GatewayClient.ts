/**
 * GatewayClient Service
 *
 * WebSocket client for connecting to OpenClaw Gateway
 * Supports:
 * - WebSocket long connection
 * - Ed25519 device signature authentication
 * - Token/Password authentication
 * - Request-response pattern (req/res)
 * - Event subscription (on/off)
 * - Heartbeat (tick)
 * - Auto-reconnect
 * - Message queue
 */

import { logger } from '../utils/logger';
import type {
  GatewayConnectionOptions,
  EventHandler,
  EvtFrame,
} from '../types/gateway';

class GatewayClient {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private token: string | null = null;
  private password: string | null = null;
  private deviceId: string | null = null;
  private deviceKey: string | null = null;
  private connected = false;
  private authenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private messageQueue: { method: string; params?: Record<string, unknown> }[] = [];
  private lastMessageTime = 0;
  private seq = 0;
  private eventListeners = new Map<string, Set<EventHandler>>();

  constructor() {
    this.loadDeviceCredentials();
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return `${Date.now()}-${++this.seq}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Load device credentials from localStorage
   */
  private loadDeviceCredentials(): void {
    this.deviceId = localStorage.getItem('gateway_device_id');
    this.deviceKey = localStorage.getItem('gateway_device_key');
  }

  /**
   * Save device credentials to localStorage
   */
  private saveDeviceCredentials(): void {
    if (this.deviceId) {
      localStorage.setItem('gateway_device_id', this.deviceId);
    }
    if (this.deviceKey) {
      localStorage.setItem('gateway_device_key', this.deviceKey);
    }
  }

  /**
   * Generate Ed25519 key pair
   */
  private async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'Ed25519',
      },
      true,
      ['sign', 'verify']
    );

    const publicKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
      privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKey))),
    };
  }

  /**
   * Sign data with private key
   */
  private async sign(data: string): Promise<string> {
    if (!this.deviceKey) {
      throw new Error('No device key available');
    }

    const privateKey = await window.crypto.subtle.importKey(
      'pkcs8',
      Uint8Array.from(atob(this.deviceKey), c => c.charCodeAt(0)),
      { name: 'Ed25519' },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign(
      { name: 'Ed25519' },
      privateKey,
      new TextEncoder().encode(data)
    );

    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * Connect to Gateway
   */
  async connect(options: GatewayConnectionOptions): Promise<void> {
    const { url, token, password, deviceId, deviceKey, reconnect = true } = options;

    this.url = url;
    this.token = token || null;
    this.password = password || null;
    this.maxReconnectAttempts = reconnect ? 10 : 0;

    // Generate or use provided device credentials
    if (!deviceId || !deviceKey) {
      const keys = await this.generateKeyPair();
      this.deviceId = `device_${this.generateRandomId(16)}`;
      this.deviceKey = keys.privateKey;
      this.saveDeviceCredentials();
    } else {
      this.deviceId = deviceId;
      this.deviceKey = deviceKey;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          logger.gateway.debug('[GatewayClient] WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.authenticate().then(resolve).catch(reject);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          logger.gateway.debug('[GatewayClient] WebSocket closed');
          this.connected = false;
          this.authenticated = false;
          this.stopHeartbeat();
          this.emit('disconnect');

          if (reconnect && this.maxReconnectAttempts > 0) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          logger.gateway.error('[GatewayClient] WebSocket error:', error);
          this.emit('error', error);
        };

        // Set connection timeout
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
   * Authenticate with Gateway
   */
  private async authenticate(): Promise<void> {
    const timestamp = Date.now();
    const authPayload = {
      deviceId: this.deviceId,
      timestamp,
    };

    // Sign authentication payload
    const signature = await this.sign(JSON.stringify(authPayload));

    const authMessage = {
      type: 'auth' as const,
      deviceId: this.deviceId,
      timestamp,
      signature,
    };

    // Add token or password if provided
    if (this.token) {
      (authMessage as Record<string, unknown>).token = this.token;
    } else if (this.password) {
      (authMessage as Record<string, unknown>).password = this.password;
    }

    return new Promise((resolve, reject) => {
      const id = this.generateId();

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Authentication timeout'));
      }, 10000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.ws?.send(JSON.stringify({ ...authMessage, id }));

      // Also wait for first 'tick' event as confirmation
      const onTick = () => {
        this.off('tick', onTick);
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        this.authenticated = true;
        this.flushMessageQueue();
        this.emit('connect');
        resolve();
      };

      this.once('tick', onTick);
    });
  }

  /**
   * Generate random ID
   */
  private generateRandomId(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    this.lastMessageTime = Date.now();

    try {
      const frame = JSON.parse(data);

      switch (frame.type) {
        case 'res':
          this.handleResponse(frame);
          break;

        case 'event':
          this.handleEvent(frame);
          break;

        case 'tick':
          this.handleTick(frame);
          break;

        case 'auth':
          // Authentication response
          if (frame.ok) {
            this.authenticated = true;
          }
          break;

        default:
          logger.gateway.debug('[GatewayClient] Unknown frame type:', frame.type);
      }
    } catch (error) {
      logger.gateway.error('[GatewayClient] Failed to parse message:', error);
    }
  }

  /**
   * Handle response frame
   */
  private handleResponse(frame: { id: string; ok: boolean; payload?: unknown; error?: { message?: string } }): void {
    const pending = this.pendingRequests.get(frame.id);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(frame.id);

      if (frame.ok) {
        pending.resolve(frame.payload);
      } else {
        pending.reject(new Error(frame.error?.message || 'Request failed'));
      }
    }
  }

  /**
   * Handle event frame
   */
  private handleEvent(frame: EvtFrame): void {
    const handlers = this.eventListeners.get(frame.event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(frame.payload);
        } catch (error) {
          logger.gateway.error(`[GatewayClient] Event handler error (${frame.event}):`, error);
        }
      });
    }

    // Also emit wildcard event
    const wildcardHandlers = this.eventListeners.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(frame);
        } catch (error) {
          logger.gateway.error('[GatewayClient] Wildcard event handler error:', error);
        }
      });
    }
  }

  /**
   * Handle tick (heartbeat)
   */
  private handleTick(frame: { timestamp: number }): void {
    // Send pong
    this.ws?.send(JSON.stringify({ type: 'tick', timestamp: Date.now() }));
  }

  /**
   * Send request and wait for response
   */
  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.connected || !this.authenticated) {
      throw new Error('Not connected or authenticated');
    }

    const id = this.generateId();
    const frame = {
      type: 'req' as const,
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timeout`));
      }, 60000); // 60 second timeout

      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
      this.ws?.send(JSON.stringify(frame));
    });
  }

  /**
   * Send notification (no response expected)
   */
  send(method: string, params?: Record<string, unknown>): void {
    if (!this.connected || !this.authenticated) {
      logger.gateway.warn('[GatewayClient] Not connected, queueing message');
      this.messageQueue.push({ method, params });
      return;
    }

    const frame = {
      type: 'req' as const,
      id: this.generateId(),
      method,
      params,
    };

    this.ws?.send(JSON.stringify(frame));
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.send(msg.method, msg.params);
      }
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    // Send tick every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        this.ws?.send(JSON.stringify({ type: 'tick', timestamp: Date.now() }));

        // Check if we've received messages recently
        if (Date.now() - this.lastMessageTime > 60000) {
          logger.gateway.warn('[GatewayClient] No messages received for 60 seconds, reconnecting...');
          this.ws?.close();
        }
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.gateway.warn('[GatewayClient] Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    logger.gateway.info(`[GatewayClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (!this.connected && this.url) {
        this.connect({
          url: this.url,
          token: this.token || undefined,
          password: this.password || undefined,
          deviceId: this.deviceId || undefined,
          deviceKey: this.deviceKey || undefined,
          reconnect: true,
        })
          .then(() => {
            logger.gateway.info('[GatewayClient] Reconnected successfully');
            this.emit('reconnect');
          })
          .catch((error) => {
            logger.gateway.error('[GatewayClient] Reconnection failed:', error);
          });
      }
    }, delay);
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.maxReconnectAttempts = 0; // Prevent reconnection

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.authenticated = false;

    // Reject all pending requests
    for (const [_, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
    }
    this.pendingRequests.clear();

    this.emit('disconnect');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  /**
   * Get device ID
   */
  getDeviceId(): string | null {
    return this.deviceId;
  }

  // ============================================
  // Event Handling
  // ============================================

  /**
   * Add event listener
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler as EventHandler);
  }

  /**
   * Remove event listener
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  /**
   * Add one-time event listener
   */
  once<T = unknown>(event: string, handler: EventHandler<T>): void {
    const wrappedHandler: EventHandler<T> = (data) => {
      this.off(event, wrappedHandler);
      handler(data);
    };
    this.on(event, wrappedHandler);
  }

  /**
   * Emit event
   */
  private emit<T = unknown>(event: string, data?: T): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach(h => {
        try {
          h(data);
        } catch (error) {
          logger.gateway.error(`[GatewayClient] Emit error (${event}):`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }
}

// Export singleton instance
export const gatewayClient = new GatewayClient();
export default gatewayClient;
