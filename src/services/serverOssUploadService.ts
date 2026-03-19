import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import { logger } from '../utils/logger';
import trixNativeChannelClient from './TrixNativeChannelClient';

interface UploadApiResponse {
  success?: boolean;
  url?: string;
  objectKey?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  contentType?: string;
  error?: string;
  message?: string;
}

export interface ServerOssUploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  objectKey?: string;
}

const DEV_UPLOAD_FALLBACK_URL = 'http://localhost:8788/api/uploads';

class ServerOssUploadHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ServerOssUploadHttpError';
    this.status = status;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '');
}

function inferAttachmentKind(mimeType: string, fileName: string): 'image' | 'audio' | 'video' | 'file' {
  const mime = mimeType.toLowerCase();
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(String(extension))) return 'image';
  if (['mp3', 'wav', 'ogg', 'm4a', 'opus', 'aac', 'webm'].includes(String(extension))) return 'audio';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(String(extension))) return 'video';
  return 'file';
}

function resolveNativeHttpBaseUrl(): string {
  const { nativePublicUrl, nativeServerUrl } = getClawbotEndpoints();
  const configuredBaseUrl = nativePublicUrl || nativeServerUrl;

  if (configuredBaseUrl) {
    const parsed = new URL(configuredBaseUrl);
    parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : parsed.protocol;
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return normalizeBaseUrl(parsed.toString());
  }

  // 生产环境优先使用 __PROD_UPLOAD_URL__
  if (typeof window !== 'undefined') {
    const prodUploadUrl = (window as any).__PROD_UPLOAD_URL__;
    if (prodUploadUrl) {
      try {
        const parsed = new URL(prodUploadUrl);
        parsed.pathname = '';
        parsed.search = '';
        parsed.hash = '';
        return normalizeBaseUrl(parsed.toString());
      } catch (error) {
        // Invalid URL, continue to fallback
        logger.debug('ServerOssUpload', 'Invalid URL parsing, using fallback:', error);
      }
    }

    // Fallback: 基于当前页面 URL 自动检测
    const currentOrigin = window.location.origin;
    if (currentOrigin) {
      return normalizeBaseUrl(currentOrigin);
    }
  }

  if (import.meta.env.DEV) {
    return normalizeBaseUrl(DEV_UPLOAD_FALLBACK_URL.replace(/\/api\/uploads$/, ''));
  }

  throw new Error('TRIX Native upload base URL is not configured');
}

function resolveUploadUrls(): string[] {
  const uploadUrls: string[] = [];
  const legacyExplicitEndpoint = import.meta.env.VITE_OSS_ENDPOINT?.trim();
  if (legacyExplicitEndpoint) {
    const normalized = normalizeBaseUrl(legacyExplicitEndpoint);
    uploadUrls.push(normalized.endsWith('/upload') ? normalized : `${normalized}/upload`);
  }

  try {
    uploadUrls.push(`${resolveNativeHttpBaseUrl()}/api/uploads`);
  } catch (error) {
    if (uploadUrls.length === 0) {
      throw error;
    }
  }
  if (import.meta.env.DEV) {
    uploadUrls.push(DEV_UPLOAD_FALLBACK_URL);
  }

  return [...new Set(uploadUrls)];
}

function shouldFallbackToNextUrl(error: unknown): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  if (error instanceof ServerOssUploadHttpError) {
    return [404, 502, 503, 504].includes(error.status);
  }

  return error instanceof TypeError;
}

async function uploadAtUrl(
  uploadUrl: string,
  file: File,
  signal?: AbortSignal
): Promise<ServerOssUploadResult> {
  const isNativeUploadEndpoint = uploadUrl.endsWith('/api/uploads');
  let response: Response;
  let payload: UploadApiResponse | null = null;

  if (isNativeUploadEndpoint) {
    const session = trixNativeChannelClient.getSession();
    if (!session) {
      throw new Error('TRIX Native session is required before uploading attachments');
    }

    response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'x-file-name': encodeURIComponent(file.name),
        'x-mime-type': file.type || 'application/octet-stream',
        'x-attachment-kind': inferAttachmentKind(file.type || 'application/octet-stream', file.name),
        'x-trix-conversation-id': session.conversationId,
        'x-trix-client-token': session.clientToken,
      },
      body: file,
      signal,
    });
  } else {
    const formData = new FormData();
    formData.append('file', file, file.name);

    response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      signal,
    });
  }

  try {
    payload = (await response.json()) as UploadApiResponse;
  } catch (error) {
    logger.debug('ServerOssUpload', 'Failed to parse upload response:', error);
    payload = null;
  }

  if (!response.ok) {
    const errorMessage = payload?.error || payload?.message || `Upload failed with status ${response.status}`;
    throw new ServerOssUploadHttpError(response.status, errorMessage);
  }

  const nativePayload = payload as UploadApiResponse & {
    attachment?: {
      publicUrl?: string;
      fileName?: string;
      sizeBytes?: number;
      mimeType?: string;
      id?: string;
    };
  };

  const mediaUrl = nativePayload.attachment?.publicUrl || payload?.url;
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    throw new Error('Upload succeeded but response did not include a valid URL');
  }

  const mimeType = nativePayload.attachment?.mimeType || payload?.mimeType || payload?.contentType || file.type || 'application/octet-stream';
  const responseSize = Number(nativePayload.attachment?.sizeBytes ?? payload?.size);

  return {
    url: mediaUrl,
    filename: nativePayload.attachment?.fileName || payload?.filename || file.name,
    size: Number.isFinite(responseSize) ? responseSize : file.size,
    mimeType,
    objectKey: payload?.objectKey || nativePayload.attachment?.id,
  };
}

export function isServerOssUploadEnabled(): boolean {
  return import.meta.env.VITE_USE_SERVER_OSS_UPLOAD !== 'false';
}

export async function uploadFileToServerOss(
  file: File,
  signal?: AbortSignal
): Promise<ServerOssUploadResult> {
  const uploadUrls = resolveUploadUrls();
  let lastError: unknown = null;

  for (let i = 0; i < uploadUrls.length; i += 1) {
    const uploadUrl = uploadUrls[i];
    if (!uploadUrl) continue;
    try {
      return await uploadAtUrl(uploadUrl, file, signal);
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      lastError = error;
      const hasNextCandidate = i < uploadUrls.length - 1;
      if (hasNextCandidate && shouldFallbackToNextUrl(error)) {
        continue;
      }
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Upload failed: no available endpoint');
}
