import http from 'node:http';
import net from 'node:net';
import type { ServerRateLimitName, ServerRateLimitRule } from '../types.js';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export const DEFAULT_RATE_LIMITS: Record<ServerRateLimitName, ServerRateLimitRule> = {
  claim: { max: 10, windowMs: 60_000 },
  userMessages: { max: 120, windowMs: 60_000 },
  userUploads: { max: 30, windowMs: 60_000 },
  serviceMessages: { max: 240, windowMs: 60_000 },
  serviceUploads: { max: 120, windowMs: 60_000 },
};

export function parseCommaSeparatedList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function normalizeIp(raw: string | undefined | null): string | null {
  if (!raw) {
    return null;
  }

  const firstHop = raw.split(',')[0]?.trim();
  if (!firstHop) {
    return null;
  }

  let withoutPort = firstHop;
  if (firstHop.startsWith('[')) {
    withoutPort = firstHop.replace(/^\[|\]$/g, '');
  } else if (firstHop.includes('.') && firstHop.includes(':') && firstHop.indexOf(':') === firstHop.lastIndexOf(':')) {
    withoutPort = firstHop.replace(/:\d+$/, '');
  }
  const normalized = withoutPort.replace(/^::ffff:/i, '').replace(/%.+$/, '');
  if (normalized === '::1') {
    return '127.0.0.1';
  }
  return normalized;
}

function getForwardedForHeader(request: http.IncomingMessage): string | null {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return normalizeIp(forwardedFor);
  }
  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return normalizeIp(forwardedFor[0]);
  }
  return null;
}

export function getRequestIp(request: http.IncomingMessage, trustedProxyAllowlist: string[] = []): string | null {
  const remoteIp = normalizeIp(request.socket.remoteAddress);
  const forwardedIp = getForwardedForHeader(request);
  if (!forwardedIp) {
    return remoteIp;
  }

  if (!remoteIp) {
    return null;
  }

  const trustedProxies = ['127.0.0.1', ...trustedProxyAllowlist];
  if (!isIpAllowed(remoteIp, trustedProxies)) {
    return remoteIp;
  }

  return forwardedIp;
}

function ipv4ToInt(ip: string): number | null {
  const octets = ip.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return (((octets[0] ?? 0) << 24) >>> 0)
    + (((octets[1] ?? 0) << 16) >>> 0)
    + (((octets[2] ?? 0) << 8) >>> 0)
    + ((octets[3] ?? 0) >>> 0);
}

function isIpv4InCidr(ip: string, cidr: string): boolean {
  const [rangeIp, prefixRaw] = cidr.split('/');
  const prefix = Number(prefixRaw);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(rangeIp ?? '');
  if (ipInt === null || rangeInt === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  if (prefix === 0) {
    return true;
  }

  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

export function isIpAllowed(ip: string | null, allowlist: string[]): boolean {
  if (!allowlist.length) {
    return true;
  }
  if (!ip) {
    return false;
  }
  if (ip === '127.0.0.1') {
    return true;
  }

  for (const entry of allowlist) {
    if (!entry.includes('/')) {
      const normalizedEntry = normalizeIp(entry);
      if (!normalizedEntry) {
        continue;
      }
      if (normalizedEntry === ip) {
        return true;
      }
      continue;
    }

    const [rawBase, rawPrefix] = entry.split('/');
    const normalizedBase = normalizeIp(rawBase);
    if (normalizedBase && net.isIP(ip) === 4 && net.isIP(normalizedBase) === 4 && isIpv4InCidr(ip, `${normalizedBase}/${rawPrefix ?? ''}`)) {
      return true;
    }
  }

  return false;
}

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  consume(scope: ServerRateLimitName, subject: string, rule: ServerRateLimitRule): boolean {
    if (rule.max <= 0 || rule.windowMs <= 0) {
      return true;
    }

    const now = Date.now();
    const key = `${scope}:${subject}`;
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      this.cleanup(now);
      return true;
    }

    if (existing.count >= rule.max) {
      return false;
    }

    existing.count += 1;
    this.buckets.set(key, existing);
    return true;
  }

  private cleanup(now: number): void {
    if (this.buckets.size < 1024) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
