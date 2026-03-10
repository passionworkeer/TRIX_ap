/**
 * Protocol - JSON-RPC Frame Handling
 *
 * Handles encoding/decoding of WebSocket frames
 */

import type { Frame, ReqFrame, ResFrame, EvtFrame } from './types.js';

/**
 * Generate a unique ID for requests
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Create a request frame
 */
export function createReqFrame(
  method: string,
  params?: Record<string, unknown>
): ReqFrame {
  return {
    type: 'req',
    id: generateId(),
    method,
    params,
  };
}

/**
 * Create a response frame
 */
export function createResFrame(
  id: string,
  ok: boolean,
  payload?: unknown,
  error?: { message: string }
): ResFrame {
  return {
    type: 'res',
    id,
    ok,
    payload,
    error,
  };
}

/**
 * Create an event frame
 */
export function createEventFrame(
  event: string,
  payload?: unknown,
  seq?: number
): EvtFrame {
  return {
    type: 'event',
    event,
    payload,
    seq,
  };
}

/**
 * Parse a raw message into a frame
 */
export function parseFrame(raw: string): Frame | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.type !== 'string') {
      return null;
    }
    return parsed as Frame;
  } catch {
    return null;
  }
}

/**
 * Serialize a frame to string
 */
export function serializeFrame(frame: Frame): string {
  return JSON.stringify(frame);
}

/**
 * Check if frame is a request
 */
export function isReqFrame(frame: Frame): frame is ReqFrame {
  return frame.type === 'req';
}

/**
 * Check if frame is a response
 */
export function isResFrame(frame: Frame): frame is ResFrame {
  return frame.type === 'res';
}

/**
 * Check if frame is an event
 */
export function isEvtFrame(frame: Frame): frame is EvtFrame {
  return frame.type === 'event';
}
