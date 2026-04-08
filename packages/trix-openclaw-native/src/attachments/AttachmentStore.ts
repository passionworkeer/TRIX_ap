import { lookup } from 'node:dns/promises';
import fs from 'node:fs/promises';
import { isIP } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { randomId, sha256Hex } from '../utils/ids.js';
import type {
  AttachmentDescriptor,
  AttachmentInput,
  AttachmentKind,
  StoredAttachmentForOpenClaw,
  UploadResponse,
} from '../types.js';

const IMAGE_PREFIXES = ['image/'];
const AUDIO_PREFIXES = ['audio/'];
const VIDEO_PREFIXES = ['video/'];
const MAX_REMOTE_ATTACHMENT_BYTES = Number(process.env.TRIX_NATIVE_MAX_REMOTE_ATTACHMENT_BYTES || 25 * 1024 * 1024);

function isLocalAttachmentPathsEnabled(): boolean {
  return process.env.TRIX_NATIVE_ALLOW_LOCAL_ATTACHMENT_PATHS === '1';
}

function getAllowedLocalAttachmentRoots(): string[] {
  return String(process.env.TRIX_NATIVE_ALLOWED_LOCAL_ATTACHMENT_ROOTS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
}

function isPrivateIpAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpAddress(normalized.slice(7));
  }

  const version = isIP(normalized);
  if (version === 4) {
    const octets = normalized.split('.').map((part) => Number(part));
    const firstOctet = octets[0];
    const secondOctet = octets[1];
    return (
      firstOctet === 0
      || firstOctet === 10
      || firstOctet === 127
      || (firstOctet === 169 && secondOctet === 254)
      || (firstOctet === 172 && secondOctet !== undefined && secondOctet >= 16 && secondOctet <= 31)
      || (firstOctet === 192 && secondOctet === 168)
    );
  }

  if (version === 6) {
    return (
      normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:')
    );
  }

  return false;
}

async function assertSafeRemoteUrl(rawUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Attachment URL is invalid');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Attachment URL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Attachment URL must not include credentials');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('Attachment URL must not target local/private hosts');
  }
  if (isPrivateIpAddress(hostname)) {
    throw new Error('Attachment URL must not target private IPs');
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some((entry) => isPrivateIpAddress(entry.address))) {
    throw new Error('Attachment URL resolves to a private address');
  }

  return parsed.toString();
}

function isPathInsideRoot(targetPath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertAllowedLocalPath(rawPath: string, implicitAllowedRoots: string[] = []): string {
  const allowedRoots = [
    ...implicitAllowedRoots.map((entry) => path.resolve(entry)),
    ...getAllowedLocalAttachmentRoots(),
  ].filter((entry, index, list) => Boolean(entry) && list.indexOf(entry) === index);

  if (!isLocalAttachmentPathsEnabled() && allowedRoots.length === 0) {
    throw new Error('Local attachment paths are disabled');
  }

  if (allowedRoots.length === 0) {
    throw new Error('Local attachment roots are not configured');
  }

  const resolvedPath = path.resolve(rawPath);
  if (!allowedRoots.some((rootPath) => isPathInsideRoot(resolvedPath, rootPath))) {
    throw new Error('Local attachment path is outside allowed roots');
  }

  return resolvedPath;
}

async function fetchRemoteAttachment(rawUrl: string): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}> {
  const safeUrl = await assertSafeRemoteUrl(rawUrl);
  const response = await fetch(safeUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch attachment URL: ${response.status} ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_REMOTE_ATTACHMENT_BYTES) {
    throw new Error('Attachment URL content is too large');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_REMOTE_ATTACHMENT_BYTES) {
    throw new Error('Attachment URL content is too large');
  }

  const parsedUrl = new URL(safeUrl);
  return {
    buffer,
    fileName: parsedUrl.pathname.split('/').pop() || 'reply-media.bin',
    mimeType: response.headers.get('content-type') ?? 'application/octet-stream',
  };
}

async function readLocalAttachment(rawPath: string, implicitAllowedRoots: string[] = []): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}> {
  const resolvedPath = assertAllowedLocalPath(rawPath, implicitAllowedRoots);
  return {
    buffer: await fs.readFile(resolvedPath),
    fileName: path.basename(resolvedPath),
    mimeType: 'application/octet-stream',
  };
}

function inferKind(mimeType: string | undefined, fileName: string | undefined): AttachmentKind {
  const mime = mimeType?.toLowerCase() ?? '';
  if (IMAGE_PREFIXES.some((prefix) => mime.startsWith(prefix))) return 'image';
  if (AUDIO_PREFIXES.some((prefix) => mime.startsWith(prefix))) return 'audio';
  if (VIDEO_PREFIXES.some((prefix) => mime.startsWith(prefix))) return 'video';

  const extension = fileName?.split('.').pop()?.toLowerCase();
  if (extension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) return 'image';
  if (extension && ['mp3', 'wav', 'ogg', 'm4a', 'opus', 'aac'].includes(extension)) return 'audio';
  if (extension && ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) return 'video';
  return 'file';
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export class AttachmentStore {
  private readonly attachmentDir: string;
  private readonly uploadBaseUrl?: string;
  private readonly implicitAllowedLocalRoots: string[];

  constructor(storageDir: string, uploadBaseUrl?: string) {
    const resolvedStorageDir = path.resolve(storageDir);
    this.attachmentDir = path.join(resolvedStorageDir, 'attachments');
    this.uploadBaseUrl = uploadBaseUrl?.replace(/\/$/, '');
    this.implicitAllowedLocalRoots = [
      resolvedStorageDir,
      path.resolve(os.homedir(), '.openclaw', 'media'),
    ];
  }

  async ensure(): Promise<void> {
    await fs.mkdir(this.attachmentDir, { recursive: true });
  }

  async saveFromInput(input: AttachmentInput): Promise<AttachmentDescriptor> {
    const buffer = await this.resolveBuffer(input);
    const fileName = sanitizeFileName(input.fileName ?? `${randomId('attachment', 6)}.bin`);
    const mimeType = input.mimeType ?? 'application/octet-stream';
    const kind = input.kind ?? inferKind(mimeType, fileName);
    const id = randomId('att', 8);
    const year = new Date().getUTCFullYear().toString();
    const month = String(new Date().getUTCMonth() + 1).padStart(2, '0');
    const targetDir = path.join(this.attachmentDir, year, month);
    const filePath = path.join(targetDir, `${id}-${fileName}`);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(filePath, buffer);
    const sha256 = sha256Hex(buffer);

    return {
      id,
      accountId: input.accountId,
      conversationId: input.conversationId,
      kind,
      mimeType,
      fileName,
      sizeBytes: buffer.byteLength,
      sha256,
      storagePath: filePath,
      publicUrl: this.uploadBaseUrl ? `${this.uploadBaseUrl}/api/attachments/${id}` : undefined,
      width: input.width,
      height: input.height,
      durationMs: input.durationMs,
      createdAt: Date.now(),
    };
  }

  async saveBuffer(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    kind?: AttachmentKind;
    accountId?: string;
    conversationId?: string;
  }): Promise<AttachmentDescriptor> {
    return this.saveFromInput({
      fileName: params.fileName,
      mimeType: params.mimeType,
      kind: params.kind,
      accountId: params.accountId,
      conversationId: params.conversationId,
      contentBase64: params.buffer.toString('base64'),
    });
  }

  async readAttachment(descriptor: AttachmentDescriptor): Promise<StoredAttachmentForOpenClaw> {
    const buffer = await fs.readFile(descriptor.storagePath);
    return {
      descriptor,
      contentBase64: buffer.toString('base64'),
    };
  }

  async readAll(descriptors: AttachmentDescriptor[]): Promise<StoredAttachmentForOpenClaw[]> {
    return Promise.all(descriptors.map(async (entry) => this.readAttachment(entry)));
  }

  async loadReplyMedia(mediaUrl: string): Promise<AttachmentDescriptor> {
    if (/^https?:\/\//i.test(mediaUrl)) {
      const { buffer, fileName, mimeType } = await fetchRemoteAttachment(mediaUrl);
      return this.saveBuffer({ buffer, fileName, mimeType });
    }

    const { buffer, fileName, mimeType } = await readLocalAttachment(mediaUrl, this.implicitAllowedLocalRoots);
    return this.saveBuffer({
      buffer,
      fileName,
      mimeType,
    });
  }

  async createUploadResponse(params: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    kind?: AttachmentKind;
    accountId?: string;
    conversationId?: string;
  }): Promise<UploadResponse> {
    const attachment = await this.saveBuffer(params);
    return { attachment };
  }

  private async resolveBuffer(input: AttachmentInput): Promise<Buffer> {
    if (input.contentBase64) {
      return Buffer.from(input.contentBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    }

    if (input.localPath) {
      return (await readLocalAttachment(input.localPath, this.implicitAllowedLocalRoots)).buffer;
    }

    if (input.url) {
      return (await fetchRemoteAttachment(input.url)).buffer;
    }

    throw new Error('Attachment input requires contentBase64, localPath, or url');
  }
}
