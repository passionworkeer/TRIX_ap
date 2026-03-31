import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (!normalized) {
    return false;
  }

  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    return true;
  }

  if (
    normalized === '::1'
    || normalized === '::ffff:127.0.0.1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
  ) {
    return true;
  }

  const ipv4Match = normalized.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4Match) {
    return false;
  }

  const octets = ipv4Match.slice(1).map((value) => Number(value));
  const a = octets[0];
  const b = octets[1];
  if (a == null || b == null) {
    return false;
  }
  if ([a, b].some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }

  return (
    a === 127
    || a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
  );
}

function shouldBypassProxy(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (url.protocol === 'http:' || url.protocol === 'https:') && isPrivateOrLoopbackHost(url.hostname);
  } catch {
    return false;
  }
}

function buildRequestBody(body: BodyInit | null | undefined): Buffer | undefined {
  if (body == null) {
    return undefined;
  }
  if (typeof body === 'string') {
    return Buffer.from(body);
  }
  if (body instanceof URLSearchParams) {
    return Buffer.from(body.toString());
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
  if (body instanceof Blob) {
    throw new TypeError('Blob request bodies are not supported for loopback transport');
  }
  if (body instanceof ReadableStream) {
    throw new TypeError('ReadableStream request bodies are not supported for loopback transport');
  }
  return Buffer.from(String(body));
}

async function fetchViaNodeTransport(
  input: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<Response> {
  const url = new URL(input);
  const transport = url.protocol === 'https:' ? https : http;
  const body = buildRequestBody(init.body);
  const headers = new Headers(init.headers);
  if (body && !headers.has('content-length')) {
    headers.set('content-length', String(body.byteLength));
  }
  const requestHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  return await new Promise<Response>((resolve, reject) => {
    const request = transport.request(url, {
      method: init.method ?? 'GET',
      headers: requestHeaders,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on('end', () => {
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) {
            for (const item of value) {
              responseHeaders.append(key, item);
            }
            continue;
          }
          if (typeof value === 'string') {
            responseHeaders.set(key, value);
          }
        }
        resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode ?? 200,
          statusText: response.statusMessage ?? '',
          headers: responseHeaders,
        }));
      });
      response.on('error', reject);
    });

    const abort = () => request.destroy(new Error(`Request aborted: ${input}`));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    request.on('error', reject);
    if (body) {
      request.write(body);
    }
    request.end();
  });
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const signal = init.signal
    ? (typeof AbortSignal.any === 'function'
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal)
    : controller.signal;

  try {
    if (shouldBypassProxy(input)) {
      return await fetchViaNodeTransport(input, init, signal);
    }
    return await fetch(input, {
      ...init,
      signal,
    });
  } catch (error) {
    const abortedByTimeout = controller.signal.aborted && !(init.signal?.aborted ?? false);
    if (abortedByTimeout) {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${input}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
