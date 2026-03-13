import { getClawbotEndpoints } from '../config/clawbotEndpoints';

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

const DEV_UPLOAD_FALLBACK_URL = 'http://localhost:8765/upload';

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

function resolveChannelHttpBaseUrl(): string {
  // 首先尝试从环境变量获取
  const { channelUrl } = getClawbotEndpoints();
  if (channelUrl && channelUrl !== 'ws://localhost:8765') {
    const parsed = new URL(channelUrl);
    parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
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
      } catch {
        // Invalid URL, continue to fallback
      }
    }

    // Fallback: 基于当前页面 URL 自动检测
    const currentOrigin = window.location.origin;
    if (currentOrigin) {
      return normalizeBaseUrl(currentOrigin);
    }
  }

  // 最终 fallback: 硬编码的生产服务器地址
  return 'http://TRIX_SERVER_HOST:8765';
}

function resolveUploadUrls(): string[] {
  const uploadUrls: string[] = [];
  const legacyExplicitEndpoint = import.meta.env.VITE_OSS_ENDPOINT?.trim();
  if (legacyExplicitEndpoint) {
    const normalized = normalizeBaseUrl(legacyExplicitEndpoint);
    uploadUrls.push(normalized.endsWith('/upload') ? normalized : `${normalized}/upload`);
  }

  try {
    uploadUrls.push(`${resolveChannelHttpBaseUrl()}/upload`);
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
  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    signal,
  });

  let payload: UploadApiResponse | null = null;
  try {
    payload = (await response.json()) as UploadApiResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMessage = payload?.error || payload?.message || `Upload failed with status ${response.status}`;
    throw new ServerOssUploadHttpError(response.status, errorMessage);
  }

  const mediaUrl = payload?.url;
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    throw new Error('Upload succeeded but response did not include a valid URL');
  }

  const mimeType = payload?.mimeType || payload?.contentType || file.type || 'application/octet-stream';
  const responseSize = Number(payload?.size);

  return {
    url: mediaUrl,
    filename: payload?.filename || file.name,
    size: Number.isFinite(responseSize) ? responseSize : file.size,
    mimeType,
    objectKey: payload?.objectKey,
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
