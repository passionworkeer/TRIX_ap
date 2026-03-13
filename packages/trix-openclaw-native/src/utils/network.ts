import os from 'node:os';

export function resolveLanAddress(): string | undefined {
  const interfaces = os.networkInterfaces();
  for (const values of Object.values(interfaces)) {
    for (const address of values ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return undefined;
}

export function buildPublicBaseUrl(host: string, port: number, explicit?: string): string {
  if (explicit?.trim()) {
    return explicit.replace(/\/$/, '');
  }

  const lan = host === '0.0.0.0' ? resolveLanAddress() ?? '127.0.0.1' : host;
  return `http://${lan}:${port}`;
}
