import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AttachmentStore } from '../src/attachments/AttachmentStore.js';

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trix-native-attachments-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('AttachmentStore', () => {
  it('persists a generic file and reads it back', async () => {
    const dir = await createTempDir();
    const store = new AttachmentStore(dir, 'http://127.0.0.1:8788');
    await store.ensure();

    const descriptor = await store.saveFromInput({
      fileName: 'example.txt',
      mimeType: 'text/plain',
      contentBase64: Buffer.from('hello trix', 'utf8').toString('base64'),
    });

    expect(descriptor.kind).toBe('file');
    expect(descriptor.publicUrl).toContain('/api/attachments/');

    const reloaded = await store.readAttachment(descriptor);
    expect(Buffer.from(reloaded.contentBase64, 'base64').toString('utf8')).toBe('hello trix');
  });
});
