/**
 * Gateway Client Service
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

const WebSocket = require('ws');
const crypto = require('crypto');
const EventEmitter = require('events');

class GatewayClientService extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.url = null;
    this.token = null;
    this.password = null;
    this.deviceId = null;
    this.deviceKey = null;
    this.connected = false;
    this.authenticated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.pendingRequests = new Map();
    this.messageQueue = [];
    this.lastMessageTime = Date.now();
    this.seq = 0;
  }

  /**
   * Generate unique message ID
   */
  generateId() {
    return `${Date.now()}-${++this.seq}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Generate Ed25519 key pair (for device authentication)
   */
  generateKeyPair() {
    const { generateKeyPairSync, randomBytes } = crypto;

    // Generate Ed25519 key pair
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');

    return {
      publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    };
  }

  /**
   * Sign data with private key
   */
  sign(data, privateKeyBase64) {
    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(privateKeyBase64, 'base64'),
      type: 'pkcs8',
      format: 'der'
    });

    const sign = crypto.createSign('SHA512');
    sign.update(typeof data === 'string' ? data : JSON.stringify(data));
    return sign.sign(privateKey, 'base64');
  }

  /**
   * Connect to Gateway
   */
  async connect(url, token = null, password = null, deviceId = null, deviceKey = null) {
    this.url = url;
    this.token = token;
    this.password = password;

    // Generate or use provided device credentials
    if (!deviceId || !deviceKey) {
      const keys = this.generateKeyPair();
      this.deviceId = `device_${crypto.randomBytes(8).toString('hex')}`;
      this.deviceKey = keys.privateKey;
    } else {
      this.deviceId = deviceId;
      this.deviceKey = deviceKey;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          console.log('[GatewayClient] WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('close', () => {
          console.log('[GatewayClient] WebSocket closed');
          this.connected = false;
          this.authenticated = false;
          this.stopHeartbeat();
          this.emit('disconnect');
          this.attemptReconnect();
        });

        this.ws.on('error', (error) => {
          console.error('[GatewayClient] WebSocket error:', error.message);
          this.emit('error', error);
        });

        // Wait for connection, then authenticate
        const onConnect = () => {
          this.off('error', onError);
          this.authenticate().then(resolve).catch(reject);
        };

        const onError = (error) => {
          this.off('connect', onConnect);
          reject(error);
        };

        this.once('connect', onConnect);
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
   * Authenticate with Gateway
   */
  async authenticate() {
    const authPayload = {
      deviceId: this.deviceId,
      timestamp: Date.now(),
    };

    // Sign authentication payload
    const signature = this.sign(authPayload, this.deviceKey);

    const authMessage = {
      type: 'auth',
      deviceId: this.deviceId,
      timestamp: authPayload.timestamp,
      signature,
    };

    // Add token or password if provided
    if (this.token) {
      authMessage.token = this.token;
    } else if (this.password) {
      authMessage.password = this.password;
    }

    return new Promise((resolve, reject) => {
      const id = this.generateId();

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Authentication timeout'));
      }, 10000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.ws.send(JSON.stringify({ ...authMessage, id }));

      // Also wait for first 'tick' event as confirmation
      const onTick = () => {
        this.off('tick', onTick);
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        this.authenticated = true;
        this.emit('connect');
        resolve();
      };

      this.once('tick', onTick);
    });
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    this.lastMessageTime = Date.now();

    try {
      const frame = JSON.parse(data.toString());

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
          console.log('[GatewayClient] Unknown frame type:', frame.type);
      }
    } catch (error) {
      console.error('[GatewayClient] Failed to parse message:', error);
    }
  }

  /**
   * Handle response frame
   */
  handleResponse(frame) {
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
  handleEvent(frame) {
    this.emit(frame.event, frame.payload);
    this.emit('*', frame);
  }

  /**
   * Handle tick (heartbeat)
   */
  handleTick(frame) {
    // Send pong
    this.ws.send(JSON.stringify({ type: 'tick', timestamp: Date.now() }));
  }

  /**
   * Send request and wait for response
   */
  request(method, params = {}) {
    if (!this.connected || !this.authenticated) {
      return Promise.reject(new Error('Not connected or authenticated'));
    }

    const id = this.generateId();
    const frame = {
      type: 'req',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timeout`));
      }, 60000); // 60 second timeout

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.ws.send(JSON.stringify(frame));
    });
  }

  /**
   * Send notification (no response expected)
   */
  send(method, params = {}) {
    if (!this.connected || !this.authenticated) {
      console.warn('[GatewayClient] Not connected, queueing message');
      this.messageQueue.push({ method, params });
      return;
    }

    const frame = {
      type: 'req',
      id: this.generateId(),
      method,
      params,
    };

    this.ws.send(JSON.stringify(frame));
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
   * Start heartbeat
   */
  startHeartbeat() {
    this.stopHeartbeat();

    // Send tick every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        this.ws.send(JSON.stringify({ type: 'tick', timestamp: Date.now() }));

        // Check if we've received messages recently
        if (Date.now() - this.lastMessageTime > 60000) {
          console.log('[GatewayClient] No messages received for 60 seconds, reconnecting...');
          this.ws.close();
        }
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[GatewayClient] Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[GatewayClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      if (!this.connected) {
        this.connect(this.url, this.token, this.password, this.deviceId, this.deviceKey)
          .then(() => {
            console.log('[GatewayClient] Reconnected successfully');
            this.emit('reconnect');
          })
          .catch((error) => {
            console.error('[GatewayClient] Reconnection failed:', error.message);
          });
      }
    }, delay);
  }

  /**
   * Disconnect
   */
  disconnect() {
    this.stopHeartbeat();
    this.maxReconnectAttempts = 0; // Prevent reconnection

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.authenticated = false;

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
    }
    this.pendingRequests.clear();
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
