/**
 * GatewayClient - WebSocket client for OpenClaw Gateway
 *
 * Direct connection to OpenClaw Gateway with Ed25519 authentication
 */

// Import crypto - auto-detect environment
import {
  generateKeyPair,
  buildSignedDevice,
  generateRandomId,
} from './crypto.js';
import {
  createReqFrame,
  parseFrame,
  isEvtFrame,
  isResFrame,
  serializeFrame,
} from './protocol.js';
import type {
  GatewayOptions,
  ConnectParams,
  ConnectResponse,
  EventHandler,
} from './types.js';

// WebSocket type - supports both browser and Node.js
type WebSocketType = typeof WebSocket;

const PROTOCOL_VERSION = 3;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private token: string | null = null;
  private password: string | null = null;
  private deviceId: string | null = null;
  private deviceKey: string | null = null;
  private publicKey: string | null = null;
  private connected = false;
  private authenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private lastTick = 0;
  private tickIntervalMs = 30000;
  private pendingRequests = new Map<string, PendingRequest>();
  private messageQueue: { method: string; params?: Record<string, unknown> }[] = [];
  private eventListeners = new Map<string, Set<EventHandler>>();
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private storedDeviceToken: string | null = null;

  constructor() {}

  /**
   * Connect to Gateway
   */
  async connect(options: GatewayOptions): Promise<void> {
    const { url, token, password, reconnect = true } = options;

    this.url = url;
    this.token = token || null;
    this.password = password || null;
    this.maxReconnectAttempts = reconnect ? 10 : 0;

    // Generate or use provided device credentials
    if (!this.deviceId || !this.deviceKey || !this.publicKey) {
      if (options.deviceId && options.deviceKey) {
        this.deviceId = options.deviceId;
        this.deviceKey = options.deviceKey;
      } else {
        const keys = await generateKeyPair();
        this.deviceId = `device_${generateRandomId(32)}`;
        this.deviceKey = keys.privateKey;
        this.publicKey = keys.publicKey;
      }
    }

    return new Promise((resolve, reject) => {
      try {
        this.stopped = false;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.connected = true;
          this.connectNonce = null;
          this.connectSent = false;

          // Fallback: send connect after 1s if challenge hasn't arrived
          this.connectTimer = setTimeout(() => this.sendConnect(), 1000);
        };

        this.ws.onmessage = (event) => {
          const raw = typeof event.data === 'string' ? event.data : event.data.toString();
          this.handleMessage(raw);
        };

        this.ws.onclose = (event) => {
          this.connected = false;
          this.authenticated = false;
          this.teardown();
          this.emit('disconnect', event.reason || `code ${event.code}`);

          if (reconnect && !this.stopped) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
        };

        const onConnected = () => {
          this.off('error', onError);
          resolve();
        };

        const onError = (error: unknown) => {
          this.off('connected', onConnected);
          reject(error);
        };

        this.once('connected', onConnected);
        this.once('error', onError);

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
   * Send connect request
   */
  private async sendConnect(): Promise<void> {
    if (this.connectSent) return;
    this.connectSent = true;

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const role = 'operator';
    const scopes = [
      'operator.admin',
      'operator.read',
      'operator.write',
      'operator.approvals',
      'operator.pairing',
    ];
    const clientId = 'trix-relay-client';
    const clientMode = 'ui';
    const signedAtMs = Date.now();
    const nonce = this.connectNonce ?? undefined;
    const authToken = this.storedDeviceToken ?? this.token ?? undefined;

    const device = await buildSignedDevice({
      deviceId: this.deviceId!,
      privateKey: this.deviceKey!,
      publicKey: this.publicKey!,
      clientId,
      clientMode,
      role,
      scopes,
      signedAtMs,
      token: authToken,
      nonce,
    });

    const params: ConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      role,
      scopes,
      caps: ['tool-events'],
      client: {
        id: clientId,
        displayName: 'TRIX Relay Client',
        version: '1.0.0',
        platform: 'browser',
        mode: clientMode,
      },
      device,
      auth: authToken || this.password
        ? { token: authToken || undefined, password: this.password || undefined }
        : undefined,
    };

    try {
      const helloOk = await this.request<ConnectResponse>('connect', params as unknown as Record<string, unknown>);

      if (helloOk?.auth?.deviceToken) {
        this.storedDeviceToken = helloOk.auth.deviceToken;
      }

      if (helloOk?.policy?.tickIntervalMs) {
        this.tickIntervalMs = helloOk.policy.tickIntervalMs;
      }

      this.reconnectDelay = 1000;
      this.lastTick = Date.now();
      this.startTickWatch();
      this.authenticated = true;
      this.flushMessageQueue();
      this.emit('connected');
    } catch (err) {
      this.storedDeviceToken = null;
      this.ws?.close(1008, 'connect failed');
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(raw: string): void {
    const frame = parseFrame(raw);
    if (!frame) return;

    // Event frame
    if (isEvtFrame(frame)) {
      // Handle connect.challenge
      if (frame.event === 'connect.challenge') {
        const payload = frame.payload as { nonce?: string };
        if (typeof payload?.nonce === 'string') {
          this.connectNonce = payload.nonce;
          this.sendConnect();
        }
        return;
      }

      // Handle tick
      if (frame.event === 'tick') {
        this.lastTick = Date.now();
        return;
      }

      // Forward other events
      this.emit(frame.event, frame.payload ?? null);
      this.emit('*', frame);
      return;
    }

    // Response frame
    if (isResFrame(frame)) {
      const pending = this.pendingRequests.get(frame.id);
      if (!pending) return;

      clearTimeout(pending.timeout);
      this.pendingRequests.delete(frame.id);

      if (frame.ok) {
        pending.resolve(frame.payload);
      } else {
        pending.reject(new Error(frame.error?.message ?? 'gateway error'));
      }
      return;
    }

    // Handle incoming req frames from Gateway
    if (frame.type === 'req') {
      const { id, method, params } = frame;

      // Ack immediately
      if (id && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(serializeFrame({ type: 'res', id, ok: true }));
      }

      // Forward chat.push
      if (method === 'chat.push' && params != null) {
        this.emit('chat', params);
      }
    }
  }

  /**
   * Send request and wait for response
   */
  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('gateway not connected');
    }

    const frame = createReqFrame(method, params);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(frame.id);
        reject(new Error(`Request ${method} timeout`));
      }, 60000);

      this.pendingRequests.set(frame.id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
      this.ws!.send(serializeFrame(frame));
    });
  }

  /**
   * Send notification (no response expected)
   */
  send(method: string, params?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push({ method, params });
      return;
    }

    const frame = createReqFrame(method, params);
    this.ws.send(serializeFrame(frame));
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
   * Start tick watch
   */
  private startTickWatch(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
    }

    const interval = Math.max(this.tickIntervalMs, 1000);
    this.tickTimer = setInterval(() => {
      if (this.stopped || !this.lastTick) return;

      if (Date.now() - this.lastTick > this.tickIntervalMs * 2) {
        this.ws?.close(4000, 'tick timeout');
      }
    }, interval);
  }

  /**
   * Schedule reconnect
   */
  private scheduleReconnect(): void {
    if (this.stopped) return;

    // 检查重试次数
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[GatewayClient] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);

    setTimeout(() => {
      if (!this.stopped && this.url) {
        this.connect({
          url: this.url,
          token: this.token || undefined,
          password: this.password || undefined,
          reconnect: true,
        })
          .then(() => {
            this.reconnectAttempts = 0; // 重置重试计数
          })
          .catch(() => {});
      }
    }, delay);
  }

  /**
   * Cleanup timers
   */
  private teardown(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.stopped = true;
    this.teardown();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.authenticated = false;

    for (const [_, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('gateway client stopped'));
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

  once<T = unknown>(event: string, handler: EventHandler<T>): void {
    const wrappedHandler: EventHandler<T> = (data) => {
      this.off(event, wrappedHandler);
      handler(data);
    };
    this.on(event, wrappedHandler);
  }

  private emit<T = unknown>(event: string, data?: T): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(data);
        } catch (error) {
          console.error(`[GatewayClient] Emit error (${event}):`, error);
        }
      });
    }
  }
}
