import fs from 'node:fs/promises';
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

  constructor(storageDir: string, uploadBaseUrl?: string) {
    this.attachmentDir = path.join(storageDir, 'attachments');
    this.uploadBaseUrl = uploadBaseUrl?.replace(/\/$/, '');
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
      const response = await fetch(mediaUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch mediaUrl: ${response.status} ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const url = new URL(mediaUrl);
      const fileName = url.pathname.split('/').pop() || 'reply-media.bin';
      const mimeType = response.headers.get('content-type') ?? 'application/octet-stream';
      return this.saveBuffer({ buffer, fileName, mimeType });
    }

    const localPath = path.resolve(mediaUrl);
    const buffer = await fs.readFile(localPath);
    const fileName = path.basename(localPath);
    return this.saveBuffer({
      buffer,
      fileName,
      mimeType: 'application/octet-stream',
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
      return fs.readFile(path.resolve(input.localPath));
    }

    if (input.url) {
      const response = await fetch(input.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch attachment URL: ${response.status} ${response.statusText}`);
      }
      return Buffer.from(await response.arrayBuffer());
    }

    throw new Error('Attachment input requires contentBase64, localPath, or url');
  }
}
