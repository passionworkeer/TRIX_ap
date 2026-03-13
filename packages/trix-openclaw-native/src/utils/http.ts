import { URL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

export async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}

export async function readBinaryBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const json = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-trix-admin-token, x-trix-client-token, x-file-name, x-mime-type, x-attachment-kind',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  response.end(json);
}

export function sendNoContent(response: ServerResponse): void {
  response.writeHead(204, {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-trix-admin-token, x-trix-client-token, x-file-name, x-mime-type, x-attachment-kind',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  response.end();
}

export function parseUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? '/', 'http://127.0.0.1');
}
