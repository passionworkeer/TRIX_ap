/**
 * Gateway Client Service
 *
 * WebSocket client for connecting to OpenClaw Gateway
 * Compatible with ClawPilot NPM package protocol
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const EventEmitter = require('events');

const PROTOCOL_VERSION = 3;

class GatewayClientService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.url = null;
    this.token = null;
    this.password = null;
    this.deviceId = null;
    this.deviceKey = null;
    this.publicKey = null;
    this.connected = false;
    this.authenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.lastTick = 0;
    this.tickIntervalMs = 30000;
    this.pendingRequests = new Map();
    this.messageQueue = [];
    this.connectNonce = null;
    this.connectSent = false;
    this.connectTimer = null;
    this.tickTimer = null;
    this.stopped = false;
    this.storedDeviceToken = null;
  }

  /**
   * Load or create device identity
   */
  loadOrCreateDeviceIdentity() {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const IDENTITY_PATH = path.join(os.homedir(), '.clawai', 'device-identity.json');
    const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

    // Ensure directory exists
    const identityDir = path.dirname(IDENTITY_PATH);
    if (!fs.existsSync(identityDir)) {
      fs.mkdirSync(identityDir, { recursive: true });
    }

    if (fs.existsSync(IDENTITY_PATH)) {
      try {
        const stored = JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf8'));
        if (stored.deviceId && stored.publicKeyPem && stored.privateKeyPem) {
          return {
            deviceId: stored.deviceId,
            publicKeyPem: stored.publicKeyPem,
            privateKeyPem: stored.privateKeyPem
          };
        }
      } catch (e) {
        // fall through
      }
    }

    // Generate new key pair
    const { generateKeyPairSync } = crypto;
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');

    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    // Derive deviceId from public key
    const spki = publicKey.export({ type: 'spki', format: 'der' });
    const rawKey = spki.length === ED25519_SPKI_PREFIX.length + 32
      ? spki.subarray(ED25519_SPKI_PREFIX.length)
      : spki;
    const deviceId = crypto.createHash('sha256').update(rawKey).digest('hex');

    const identity = { deviceId, publicKeyPem, privateKeyPem };

    fs.writeFileSync(
      IDENTITY_PATH,
      JSON.stringify({ version: 1, ...identity, createdAtMs: Date.now() }, null, 2) + '\n',
      { mode: 0o600 }
    );

    return identity;
  }

  /**
   * Base64 URL encode
   */
  base64UrlEncode(buf) {
    return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
  }

  /**
   * Get raw public key bytes
   */
  rawPublicKeyBytes(publicKeyPem) {
    const key = crypto.createPublicKey(publicKeyPem);
    const spki = key.export({ type: 'spki', format: 'der' });
    const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
    return spki.length === ED25519_SPKI_PREFIX.length + 32
      ? spki.subarray(ED25519_SPKI_PREFIX.length)
      : spki;
  }

  /**
   * Build signed device payload (matching ClawPilot)
   */
  buildSignedDevice(identity, opts) {
    const version = opts.nonce ? 'v2' : 'v1';
    const payload = [
      version,
      identity.deviceId,
      opts.clientId,
      opts.clientMode,
      opts.role,
      opts.scopes.join(','),
      String(opts.signedAtMs),
      opts.token ?? '',
      ...(version === 'v2' ? [opts.nonce ?? ''] : []),
    ].join('|');

    const key = crypto.createPrivateKey(identity.privateKeyPem);
    const signature = this.base64UrlEncode(crypto.sign(null, Buffer.from(payload, 'utf8'), key));

    return {
      id: identity.deviceId,
      publicKey: this.base64UrlEncode(this.rawPublicKeyBytes(identity.publicKeyPem)),
      signature,
      signedAt: opts.signedAtMs,
      nonce: opts.nonce,
    };
  }

  /**
   * Connect to Gateway
   */
  async connect(url, token = null, password = null) {
    this.url = url;
    this.token = token;
    this.password = password;

    // Load device identity
    this.identity = this.loadOrCreateDeviceIdentity();
    this.deviceId = this.identity.deviceId;

    return new Promise((resolve, reject) => {
      try {
        this.stopped = false;
        this.ws = new WebSocket(url, { maxPayload: 25 * 1024 * 1024 });

        this.ws.on('open', () => {
          console.log('[GatewayClient] WebSocket connected');
          this.connected = true;
          this.connectNonce = null;
          this.connectSent = false;

          // Fallback: send connect after 1s if challenge hasn't arrived
          this.connectTimer = setTimeout(() => this.sendConnect(), 1000);
        });

        this.ws.on('message', (data) => {
          const raw = typeof data === 'string' ? data : data.toString();
          this.handleMessage(raw);
        });

        this.ws.on('close', (code, reason) => {
          console.log('[GatewayClient] WebSocket closed:', reason.toString() || `code ${code}`);
          this.connected = false;
          this.authenticated = false;
          this.teardown();
          this.emit('disconnect', reason.toString() || `code ${code}`);
          this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
          console.error('[GatewayClient] WebSocket error:', error.message);
          this.emit('error', error);
        });

        // Wait for connection
        const onConnected = () => {
          this.off('error', onError);
          resolve();
        };

        const onError = (error) => {
          this.off('connected', onConnected);
          reject(error);
        };

        this.once('connected', onConnected);
        this.once('error', onError);

        // Set connection timeout
        setTimeout(() => {
          if (!this.connected) {
            this.ws.close();
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
  sendConnect() {
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
    const authToken = this.storedDeviceToken ?? this.token;

    const device = this.buildSignedDevice(this.identity, {
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

    this.request('connect', params)
      .then((helloOk) => {
        // Store device token if provided
        const deviceToken = helloOk?.auth?.deviceToken;
        if (typeof deviceToken === 'string') {
          this.storedDeviceToken = deviceToken;
        }

        // Update tick interval if provided
        if (typeof helloOk?.policy?.tickIntervalMs === 'number') {
          this.tickIntervalMs = helloOk.policy.tickIntervalMs;
        }

        this.reconnectDelay = 1000;
        this.lastTick = Date.now();
        this.startTickWatch();
        this.authenticated = true;
        this.flushMessageQueue();
        this.emit('connected');
      })
      .catch((err) => {
        console.error('[GatewayClient] connect failed:', err.message);
        this.storedDeviceToken = null;
        this.ws?.close(1008, 'connect failed');
      });
  }

  /**
   * Handle incoming message
   */
  handleMessage(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (typeof parsed?.type !== 'string') return;

    // Event frame
    if (parsed.type === 'event') {
      const evt = parsed;

      // Handle connect.challenge
      if (evt.event === 'connect.challenge') {
        const nonce = evt.payload?.nonce;
        if (typeof nonce === 'string') {
          this.connectNonce = nonce;
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
    if (parsed.type === 'res') {
      const pending = this.pendingRequests.get(parsed.id);
      if (!pending) return;

      this.pendingRequests.delete(parsed.id);
      if (parsed.ok) {
        pending.resolve(parsed.payload);
      } else {
        pending.reject(new Error(parsed.error?.message ?? 'gateway error'));
      }
      return;
    }

    // Handle incoming req frames from OpenClaw (e.g. chat.push)
    if (parsed.type === 'req') {
      const { id, method, params } = parsed;
      console.log(`[GatewayClient] incoming req: method=${method}`);

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
   * Send request (no response expected)
   */
  send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[GatewayClient] Not connected, queueing message');
      this.messageQueue.push({ method, params });
      return;
    }

    const frame = { type: 'req', id: crypto.randomUUID(), method, params };
    this.ws.send(JSON.stringify(frame));
  }

  /**
   * Send request and wait for response
   */
  request(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('gateway not connected'));
    }

    const id = crypto.randomUUID();
    const frame = { type: 'req', id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timeout`));
      }, 60000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.ws.send(JSON.stringify(frame));
    });
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      this.send(msg.method, msg.params);
    }
  }

  /**
   * Start tick watch
   */
  startTickWatch() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
    }

    const interval = Math.max(this.tickIntervalMs, 1000);
    this.tickTimer = setInterval(() => {
      if (this.stopped || !this.lastTick) return;

      if (Date.now() - this.lastTick > this.tickIntervalMs * 2) {
        console.log('[GatewayClient] Tick timeout, reconnecting...');
        this.ws?.close(4000, 'tick timeout');
      }
    }, interval);
  }

  /**
   * Schedule reconnect
   */
  scheduleReconnect() {
    if (this.stopped) return;

    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);

    setTimeout(() => {
      if (!this.stopped) {
        this.connect(this.url, this.token, this.password)
          .then(() => {
            console.log('[GatewayClient] Reconnected successfully');
          })
          .catch((err) => {
            console.error('[GatewayClient] Reconnection failed:', err.message);
          });
      }
    }, delay).unref();
  }

  /**
   * Cleanup timers
   */
  teardown() {
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
  disconnect() {
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
  isConnected() {
    return this.connected && this.authenticated;
  }

  /**
   * Get device ID
   */
  getDeviceId() {
    return this.deviceId;
  }
}

// Singleton instance
module.exports = new GatewayClientService();
