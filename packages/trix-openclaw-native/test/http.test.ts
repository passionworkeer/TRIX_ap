import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout } from '../src/http.js';

const servers: http.Server[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(servers.splice(0).map(async (server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

async function createServer(port: number, handler: http.RequestListener): Promise<http.Server> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve());
  });
  return server;
}

describe('fetchWithTimeout', () => {
  it('bypasses proxy-aware global fetch for loopback service urls', async () => {
    await createServer(8812, (request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      request.on('end', () => {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
          method: request.method,
          authorization: request.headers.authorization ?? null,
          body: Buffer.concat(chunks).toString('utf8'),
        }));
      });
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('proxy fetch should be bypassed'));
    const response = await fetchWithTimeout('http://127.0.0.1:8812/health', {
      method: 'POST',
      headers: {
        authorization: 'Bearer loopback-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ok: true }),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      method: 'POST',
      authorization: 'Bearer loopback-token',
      body: '{"ok":true}',
    });
  });
});
