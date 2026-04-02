import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AttachmentStore } from '../src/attachments/AttachmentStore.js';

const tempDirs: string[] = [];
const originalAllowLocal = process.env.TRIX_NATIVE_ALLOW_LOCAL_ATTACHMENT_PATHS;
const originalAllowedRoots = process.env.TRIX_NATIVE_ALLOWED_LOCAL_ATTACHMENT_ROOTS;

async function createTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'trix-native-attachments-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => fs.rm(dir, { recursive: true, force: true })));
  if (originalAllowLocal === undefined) {
    delete process.env.TRIX_NATIVE_ALLOW_LOCAL_ATTACHMENT_PATHS;
  } else {
    process.env.TRIX_NATIVE_ALLOW_LOCAL_ATTACHMENT_PATHS = originalAllowLocal;
  }
  if (originalAllowedRoots === undefined) {
    delete process.env.TRIX_NATIVE_ALLOWED_LOCAL_ATTACHMENT_ROOTS;
  } else {
    process.env.TRIX_NATIVE_ALLOWED_LOCAL_ATTACHMENT_ROOTS = originalAllowedRoots;
  }
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

  it('rejects reply media downloads from private URLs', async () => {
    const dir = await createTempDir();
    const store = new AttachmentStore(dir, 'http://127.0.0.1:8788');
    await store.ensure();

    await expect(store.loadReplyMedia('http://127.0.0.1/private.png')).rejects.toThrow(/private/i);
  });

  it('only reads local attachments from configured allowlist roots', async () => {
    const dir = await createTempDir();
    const allowedRoot = path.join(dir, 'allowed');
    const blockedRoot = path.join(dir, 'blocked');
    await fs.mkdir(allowedRoot, { recursive: true });
    await fs.mkdir(blockedRoot, { recursive: true });
    const allowedFile = path.join(allowedRoot, 'image.png');
    const blockedFile = path.join(blockedRoot, 'image.png');
    await fs.writeFile(allowedFile, Buffer.from('allowed'));
    await fs.writeFile(blockedFile, Buffer.from('blocked'));

    process.env.TRIX_NATIVE_ALLOW_LOCAL_ATTACHMENT_PATHS = '1';
    process.env.TRIX_NATIVE_ALLOWED_LOCAL_ATTACHMENT_ROOTS = allowedRoot;

    const store = new AttachmentStore(dir, 'http://127.0.0.1:8788');
    await store.ensure();

    const descriptor = await store.loadReplyMedia(allowedFile);
    const reloaded = await store.readAttachment(descriptor);
    expect(Buffer.from(reloaded.contentBase64, 'base64').toString('utf8')).toBe('allowed');

    await expect(store.loadReplyMedia(blockedFile)).rejects.toThrow(/outside allowed roots/i);
  });
});
