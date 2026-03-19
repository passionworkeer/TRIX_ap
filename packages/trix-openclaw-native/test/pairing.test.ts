import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JsonStateStore } from '../src/storage/JsonStateStore.js';
import { PairingService } from '../src/pairing/PairingService.js';

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trix-native-pairing-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('PairingService', () => {
  it('creates and claims a pairing with persistence', async () => {
    const dir = await createTempDir();
    const store = new JsonStateStore(dir);
    const service = new PairingService(store);

    const created = await service.create({ publicBaseUrl: 'http://127.0.0.1:8788', label: 'Phone' });
    expect(created.code).toHaveLength(8);
    expect(created.qrDataUrl?.startsWith('data:image/png;base64,')).toBe(true);

    const claimed = await service.claim({
      code: created.code,
      secret: created.secret,
      clientId: 'phone-1',
      deviceName: 'My Phone',
    }, 'ws://127.0.0.1:8788/ws');

    expect(claimed.conversationId).toBe(created.conversationId);
    expect(claimed.clientToken.length).toBeGreaterThan(10);

    const reread = await service.get(created.code);
    expect(reread?.status).toBe('paired');
    expect(reread?.pairedClientId).toBe('phone-1');
  });

  it('rejects code-only claim without the pairing secret', async () => {
    const dir = await createTempDir();
    const store = new JsonStateStore(dir);
    const service = new PairingService(store);

    const created = await service.create({ publicBaseUrl: 'http://127.0.0.1:8788', label: 'Phone' });
    await expect(service.claim({
      code: created.code,
      clientId: 'phone-2',
      deviceName: 'Manual Device',
    }, 'ws://127.0.0.1:8788/ws')).rejects.toThrow('Pairing secret required');
  });
});
