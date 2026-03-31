import { randomBytes, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

export function isLoopbackHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  return normalized === '127.0.0.1'
    || normalized === 'localhost'
    || normalized === '::1'
    || normalized === '[::1]';
}

function resolveCanvasAccessToken({ requireAuth, authTokenFile, explicitAccessToken }) {
  const explicit = String(explicitAccessToken || '').trim();
  if (!requireAuth) {
    return { value: explicit, source: explicit ? 'env' : 'disabled' };
  }
  if (explicit) {
    return { value: explicit, source: 'env' };
  }
  try {
    if (existsSync(authTokenFile)) {
      const stored = readFileSync(authTokenFile, 'utf8').trim();
      if (stored) {
        return { value: stored, source: 'file' };
      }
    }
    const generated = randomBytes(24).toString('hex');
    mkdirSync(dirname(authTokenFile), { recursive: true });
    writeFileSync(authTokenFile, `${generated}\n`, { mode: 0o600 });
    return { value: generated, source: 'generated-file' };
  } catch (error) {
    throw new Error(
      `Failed to provision CANVAS_ACCESS_TOKEN at ${authTokenFile}: ${error.message}`,
    );
  }
}

function parseCookies(request) {
  const raw = request.headers.cookie || '';
  return Object.fromEntries(
    raw
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf('=');
        if (separator <= 0) {
          return [entry, ''];
        }
        return [entry.slice(0, separator), decodeURIComponent(entry.slice(separator + 1))];
      }),
  );
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }
  return parts.join('; ');
}

export function createCanvasSecurity({
  host,
  requireAuth,
  allowInsecurePublic,
  authTokenFile,
  explicitAccessToken,
  authCookie,
  appOrigin,
  httpError,
}) {
  const authTokenInfo = resolveCanvasAccessToken({
    requireAuth,
    authTokenFile,
    explicitAccessToken,
  });
  const accessToken = authTokenInfo.value;

  function assertSafeBindConfiguration() {
    if (!isLoopbackHost(host) && !requireAuth && !allowInsecurePublic) {
      throw new Error(
        'Refusing to expose Canvas on a non-loopback host without auth. '
        + 'Set CANVAS_REQUIRE_AUTH=true or CANVAS_ALLOW_INSECURE_PUBLIC=true to override.',
      );
    }
  }

  function matchesCanvasAccessToken(candidate) {
    if (!requireAuth) {
      return true;
    }
    if (!candidate) {
      return false;
    }
    const received = Buffer.from(String(candidate));
    const expected = Buffer.from(accessToken);
    if (received.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(received, expected);
  }

  function getCanvasPresentedToken(request) {
    const authorization = request.headers.authorization;
    const bearer = Array.isArray(authorization) ? authorization[0] : authorization;
    const match = typeof bearer === 'string' ? bearer.match(/^Bearer\s+(.+)$/i) : null;
    if (match?.[1]) {
      return match[1].trim();
    }
    const cookies = parseCookies(request);
    return cookies[authCookie];
  }

  function assertCanvasAuthenticated(request) {
    if (!requireAuth) {
      return;
    }
    if (!matchesCanvasAccessToken(getCanvasPresentedToken(request))) {
      throw httpError('Canvas authentication required', 401, 'CANVAS_AUTH_REQUIRED');
    }
  }

  function isSafeCanvasMediaUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return null;
    }
    try {
      const parsed = new URL(rawUrl, appOrigin);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }

  return {
    accessToken,
    authTokenInfo,
    assertCanvasAuthenticated,
    assertSafeBindConfiguration,
    getCanvasPresentedToken,
    isSafeCanvasMediaUrl,
    matchesCanvasAccessToken,
    serializeCookie,
  };
}
