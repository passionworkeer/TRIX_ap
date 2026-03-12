/**
 * TRIX Relay Client - Type Definitions
 *
 * Types for Gateway and Relay WebSocket communication
 */

// ============================================
// Protocol Frames
// ============================================

/**
 * Request frame (client -> server)
 */
export interface ReqFrame {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * Response frame (server -> client)
 */
export interface ResFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: ErrorInfo;
}

/**
 * Event frame (server -> client)
 */
export interface EvtFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
}

/**
 * Error information
 */
export interface ErrorInfo {
  code?: string;
  message: string;
  details?: unknown;
}

/**
 * Union of all frame types
 */
export type Frame = ReqFrame | ResFrame | EvtFrame;

// ============================================
// Connection Options
// ============================================

/**
 * Gateway connection options
 */
export interface GatewayOptions {
  url: string;
  token?: string;
  password?: string;
  deviceId?: string;
  deviceKey?: string;
  clientId?: string;
  clientMode?: string;
  displayName?: string;
  platform?: string;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

/**
 * Relay connection options
 */
export interface RelayOptions {
  server: string;
  gatewayId: string;
  accessCode: string;
}

// ============================================
// Authentication
// ============================================

/**
 * Device identity for authentication
 */
export interface DeviceIdentity {
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce?: string;
}

/**
 * Client info for connection
 */
export interface ClientInfo {
  id: string;
  displayName: string;
  version: string;
  platform: string;
  mode: string;
}

/**
 * Connection parameters
 */
export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  role: string;
  scopes: string[];
  caps: string[];
  client: ClientInfo;
  device: DeviceIdentity;
  auth?: {
    token?: string;
    password?: string;
  };
}

/**
 * Connection response
 */
export interface ConnectResponse {
  auth?: {
    deviceToken?: string;
  };
  policy?: {
    tickIntervalMs?: number;
  };
}

// ============================================
// Event Types
// ============================================

/**
 * Gateway event map
 */
export interface GatewayEvents {
  connect: void;
  disconnect: string;
  reconnect: void;
  reconnect_failed: void;
  error: Error;
  chat: unknown;
  tick: void;
  '*': EvtFrame;
}

/**
 * Relay event map
 */
export interface RelayEvents {
  connect: void;
  disconnect: string;
  authenticated: { gatewayId: string; displayName?: string };
  from_device: unknown;
  gateway_status: unknown;
  error: Error;
  '*': EvtFrame;
}

/**
 * Event handler type
 */
export type EventHandler<T = unknown> = (data: T) => void;

// ============================================
// Client Interface
// ============================================

/**
 * Base client interface
 */
export interface IClient {
  connect(options: GatewayOptions | RelayOptions): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  on<T = unknown>(event: string, handler: EventHandler<T>): void;
  off<T = unknown>(event: string, handler: EventHandler<T>): void;
}

/**
 * Gateway client interface
 */
export interface IGatewayClient extends IClient {
  request<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  send(method: string, params?: Record<string, unknown>): void;
  getDeviceId(): string | null;
}

/**
 * Relay client interface
 */
export interface IRelayClient extends IClient {
  sendToDevice(method: string, params?: Record<string, unknown>): Promise<void>;
  connectGateway(): Promise<void>;
  getGatewayId(): string | null;
  getDeviceInfo(): { gatewayId: string; displayName?: string } | null;
}
