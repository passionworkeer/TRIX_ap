/**
 * Gateway Protocol Types
 *
 * Defines all types for Gateway communication
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

// ============================================
// Authentication
// ============================================

/**
 * Authentication payload
 */
export interface AuthPayload {
  deviceId: string;
  timestamp: number;
  signature: string;
  token?: string;
  password?: string;
}

/**
 * Connection options
 */
export interface GatewayConnectionOptions {
  url: string;
  token?: string;
  password?: string;
  deviceId?: string;
  deviceKey?: string;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

// ============================================
// Chat Types
// ============================================

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

/**
 * Chat send request
 */
export interface ChatSendRequest {
  sessionId: string;
  message: string;
  stream?: boolean;
}

/**
 * Chat delta event (streaming)
 */
export interface ChatDeltaEvent {
  sessionId: string;
  delta: string;
  final?: boolean;
}

// ============================================
// Session Types
// ============================================

/**
 * Session
 */
export interface Session {
  key: string;
  label: string;
  agentId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * Session list response
 */
export interface SessionListResponse {
  sessions: Session[];
}

// ============================================
// Agent Types
// ============================================

/**
 * Agent
 */
export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  provider: string;
  skills: string[];
  enabled: boolean;
}

/**
 * Agent list response
 */
export interface AgentListResponse {
  agents: Agent[];
}

// ============================================
// Skill Types
// ============================================

/**
 * Skill
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
}

/**
 * Skill list response
 */
export interface SkillListResponse {
  skills: Skill[];
}

// ============================================
// Cron Types
// ============================================

/**
 * Cron job
 */
export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  content: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

/**
 * Cron list response
 */
export interface CronListResponse {
  jobs: CronJob[];
}

/**
 * Add cron request
 */
export interface AddCronRequest {
  name: string;
  schedule: string;
  content: string;
}

// ============================================
// Control Types
// ============================================

/**
 * Models status
 */
export interface ModelsStatus {
  provider: string;
  model: string;
  status: 'ready' | 'loading' | 'error';
  latency?: number;
}

/**
 * Check result
 */
export interface CheckResult {
  skill: string;
  status: 'ok' | 'warning' | 'error';
  message?: string;
}

/**
 * Doctor result
 */
export interface DoctorResult {
  timestamp: string;
  checks: DoctorCheck[];
}

export interface DoctorCheck {
  name: string;
  status: 'ok' | 'warning' | 'error';
  version?: string;
  message?: string;
  error?: string;
}

// ============================================
// Provider Types
// ============================================

/**
 * Provider
 */
export interface Provider {
  id: string;
  name: string;
  apiBase?: string;
  apiKey?: string;
  models?: string[];
  defaultModel?: string;
  hasApiKey?: boolean;
}

// ============================================
// Pairing Types
// ============================================

/**
 * Pairing result
 */
export interface PairingResult {
  success: boolean;
  deviceId?: string;
  deviceName?: string;
  error?: string;
}

/**
 * Pairing status
 */
export interface PairingStatus {
  paired: boolean;
  deviceId?: string;
  deviceName?: string;
  botOnline?: boolean;
  pairedAt?: string;
}

// ============================================
// Event Types
// ============================================

/**
 * Gateway event map
 */
export interface GatewayEvents {
  connect: void;
  disconnect: void;
  reconnect: void;
  reconnect_failed: void;
  error: Error;
  chat_delta: ChatDeltaEvent;
  chat_final: { sessionId: string; message: string };
  agent_typing: { sessionId: string };
  tick: { timestamp: number };
  '*': EvtFrame;
}

/**
 * Event handler type
 */
export type EventHandler<T = unknown> = (data: T) => void;
