/**
 * GatewayClient Service
 *
 * WebSocket client for connecting to OpenClaw Gateway
 * Compatible with ClawPilot NPM package protocol
 */

import { logger } from '../utils/logger';
import type {
  GatewayConnectionOptions,
  EventHandler,
  EvtFrame,
} from '../types/gateway';

const PROTOCOL_VERSION = 3;

class GatewayClient {
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
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private messageQueue: { method: string; params?: Record<string, unknown> }[] = [];
  private eventListeners = new Map<string, Set<EventHandler>>();
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private storedDeviceToken: string | null = null;

  constructor() {
    this.loadDeviceCredentials();
  }

  /**
   * Load device credentials from localStorage
   */
  private loadDeviceCredentials(): void {
    this.deviceId = localStorage.getItem('gateway_device_id');
    this.deviceKey = localStorage.getItem('gateway_device_key');
    this.publicKey = localStorage.getItem('gateway_public_key');
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
    if (this.publicKey) {
      localStorage.setItem('gateway_public_key', this.publicKey);
    }
  }

  /**
   * Generate Ed25519 key pair
   */
  private async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    const keyPair = await window.crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    );

    const publicKeyRaw = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKeyRaw = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    return {
      publicKey: this.base64UrlEncode(new Uint8Array(publicKeyRaw)),
      privateKey: this.base64UrlEncode(new Uint8Array(privateKeyRaw)),
    };
  }

  /**
   * Base64 URL encode
   */
  private base64UrlEncode(buf: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buf.byteLength; i++) {
      binary += String.fromCharCode(buf[i]);
    }
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
  }

  /**
   * Generate random UUID
   */
  private generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Sign data with private key
   */
  private async sign(data: string): Promise<string> {
    if (!this.deviceKey) {
      throw new Error('No device key available');
    }

    // Decode base64 URL to binary
    const binary = atob(this.deviceKey.replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const privateKey = await window.crypto.subtle.importKey(
      'pkcs8',
      bytes,
      { name: 'Ed25519' },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign(
      { name: 'Ed25519' },
      privateKey,
      new TextEncoder().encode(data)
    );

    return this.base64UrlEncode(new Uint8Array(signature));
  }

  /**
   * Build signed device payload (matching ClawPilot)
   */
  private async buildSignedDevice(opts: {
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    signedAtMs: number;
    token?: string;
    nonce?: string;
  }) {
    const version = opts.nonce ? 'v2' : 'v1';
    const payload = [
      version,
      this.deviceId,
      opts.clientId,
      opts.clientMode,
      opts.role,
      opts.scopes.join(','),
      String(opts.signedAtMs),
      opts.token ?? '',
      ...(version === 'v2' ? [opts.nonce ?? ''] : []),
    ].join('|');

    const signature = await this.sign(payload);

    return {
      id: this.deviceId,
      publicKey: this.publicKey,
      signature,
      signedAt: opts.signedAtMs,
      nonce: opts.nonce,
    };
  }

  /**
   * Connect to Gateway
   */
  async connect(options: GatewayConnectionOptions): Promise<void> {
    const { url, token, password, reconnect = true } = options;

    this.url = url;
    this.token = token || null;
    this.password = password || null;
    this.maxReconnectAttempts = reconnect ? 10 : 0;

    // Generate or use provided device credentials
    if (!this.deviceId || !this.deviceKey || !this.publicKey) {
      const keys = await this.generateKeyPair();
      this.deviceId = `device_${this.generateRandomId(32)}`;
      this.deviceKey = keys.privateKey;
      this.publicKey = keys.publicKey;
      this.saveDeviceCredentials();
    }

    return new Promise((resolve, reject) => {
      try {
        this.stopped = false;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          logger.gateway.debug('[GatewayClient] WebSocket connected');
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
          logger.gateway.debug('[GatewayClient] WebSocket closed:', event.reason || `code ${event.code}`);
          this.connected = false;
          this.authenticated = false;
          this.teardown();
          this.emit('disconnect', event.reason || `code ${event.code}`);

          if (reconnect && !this.stopped) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          logger.gateway.error('[GatewayClient] WebSocket error:', error);
          this.emit('error', error);
        };

        // Wait for connection
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
   * Send connect request (matching ClawPilot protocol)
   */
  private async sendConnect(): Promise<void> {
    if (this.connectSent) return;
    this.connectSent = true;

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const role = 'operator';
    const scopes = ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'];
    const clientId = 'trix-web';
    const clientMode = 'ui';
    const signedAtMs = Date.now();
    const nonce = this.connectNonce ?? undefined;
    const authToken = this.storedDeviceToken ?? this.token ?? undefined;

    const device = await this.buildSignedDevice({
      clientId,
      clientMode,
      role,
      scopes,
      signedAtMs,
      token: authToken,
      nonce,
    });

    const params = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      role,
      scopes,
      caps: ['tool-events'],
      client: {
        id: clientId,
        displayName: 'TRIX Web',
        version: '1.0.0',
        platform: 'browser',
        mode: clientMode,
      },
      device,
      auth: (authToken || this.password)
        ? { token: authToken, password: this.password }
        : undefined,
    };

    try {
      const helloOk = await this.request<{
        auth?: { deviceToken?: string };
        policy?: { tickIntervalMs?: number };
      }>('connect', params);

      // Store device token if provided
      if (helloOk?.auth?.deviceToken) {
        this.storedDeviceToken = helloOk.auth.deviceToken;
      }

      // Update tick interval if provided
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
      logger.gateway.error('[GatewayClient] connect failed:', err);
      this.storedDeviceToken = null;
      this.ws?.close(1008, 'connect failed');
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: string; event?: string; id?: string; ok?: boolean; payload?: unknown; error?: { message?: string }; method?: string; params?: unknown };
    if (typeof frame?.type !== 'string') return;

    // Event frame
    if (frame.type === 'event') {
      const evt = frame as { event: string; payload?: unknown };

      // Handle connect.challenge
      if (evt.event === 'connect.challenge') {
        const nonce = evt.payload as { nonce?: string };
        if (typeof nonce?.nonce === 'string') {
          this.connectNonce = nonce.nonce;
          this.sendConnect();
        }
        return;
      }

      // Handle tick
      if (evt.event === 'tick') {
        this.lastTick = Date.now();
        return;
      }

      // Forward other events
      this.emit(evt.event, evt.payload ?? null);
      this.emit('*', evt);
      return;
    }

    // Response frame
    if (frame.type === 'res') {
      const res = frame as { id: string; ok: boolean; payload?: unknown; error?: { message?: string } };
      const pending = this.pendingRequests.get(res.id);
      if (!pending) return;

      clearTimeout(pending.timeout);
      this.pendingRequests.delete(res.id);

      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(new Error(res.error?.message ?? 'gateway error'));
      }
      return;
    }

    // Handle incoming req frames from OpenClaw (e.g. chat.push)
    if (frame.type === 'req') {
      const { id, method, params } = frame as { id?: string; method?: string; params?: unknown };
      logger.gateway.debug(`[GatewayClient] incoming req: method=${method}`);

      // Ack immediately
      if (id && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'res', id, ok: true }));
      }

      // Forward chat.push
      if (method === 'chat.push' && params != null) {
        this.emit('chat', params);
      }
      return;
    }
  }

  /**
   * Send request and wait for response
   */
  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('gateway not connected');
    }

    const id = this.generateUUID();
    const frame = { type: 'req' as const, id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timeout`));
      }, 60000);

      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  /**
   * Send notification (no response expected)
   */
  send(method: string, params?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.gateway.warn('[GatewayClient] Not connected, queueing message');
      this.messageQueue.push({ method, params });
      return;
    }

    const frame = { type: 'req' as const, id: this.generateUUID(), method, params };
    this.ws.send(JSON.stringify(frame));
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
        logger.gateway.warn('[GatewayClient] Tick timeout, reconnecting...');
        this.ws?.close(4000, 'tick timeout');
      }
    }, interval);
  }

  /**
   * Schedule reconnect
   */
  private scheduleReconnect(): void {
    if (this.stopped) return;

    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);

    logger.gateway.info(`[GatewayClient] Reconnecting in ${delay}ms`);

    setTimeout(() => {
      if (!this.stopped && this.url) {
        this.connect({
          url: this.url,
          token: this.token || undefined,
          password: this.password || undefined,
          reconnect: true,
        })
          .then(() => {
            logger.gateway.info('[GatewayClient] Reconnected successfully');
          })
          .catch((err) => {
            logger.gateway.error('[GatewayClient] Reconnection failed:', err);
          });
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
   * Generate random ID
   */
  private generateRandomId(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
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

    // Reject all pending requests
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
