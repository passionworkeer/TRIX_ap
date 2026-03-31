import type http from 'node:http';
import { describe, expect, it } from 'vitest';
import { getRequestIp } from '../src/server/accessControl.js';

function createRequest(remoteAddress: string, forwardedFor?: string): http.IncomingMessage {
  return {
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
    socket: { remoteAddress },
  } as http.IncomingMessage;
}

describe('getRequestIp', () => {
  it('ignores x-forwarded-for from untrusted peers', () => {
    const request = createRequest('198.51.100.24', '203.0.113.8');
    expect(getRequestIp(request)).toBe('198.51.100.24');
  });

  it('trusts x-forwarded-for from loopback proxies', () => {
    const request = createRequest('::1', '203.0.113.8, 10.0.0.2');
    expect(getRequestIp(request)).toBe('203.0.113.8');
  });

  it('trusts x-forwarded-for from configured proxy allowlists', () => {
    const request = createRequest('10.0.0.15', '203.0.113.8');
    expect(getRequestIp(request, ['10.0.0.0/24'])).toBe('203.0.113.8');
  });
});
