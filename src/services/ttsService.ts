import { getClawbotEndpoints } from '../config/clawbotEndpoints';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export type TtsScene = 'welcome' | 'status' | 'bot_reply';

interface TtsRequestBody {
  text: string;
  scene: TtsScene;
  messageId?: string;
}

class TtsHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'TtsHttpError';
    this.status = status;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '');
}

function resolveNativeHttpBaseUrl(): string {
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
        logger.debug('TTS', 'Invalid URL parsing, using fallback:', error);
      }
    }
  }

  const { nativePublicUrl, nativeServerUrl } = getClawbotEndpoints();
  const configuredBaseUrl = nativePublicUrl || nativeServerUrl;
  if (!configuredBaseUrl) {
    throw new Error('TRIX Native server URL is not configured');
  }

  const parsed = new URL(configuredBaseUrl);
  parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : parsed.protocol;
  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return normalizeBaseUrl(parsed.toString());
}

function resolveTtsBaseUrls(): string[] {
  const candidates: string[] = [];
  const explicitTtsProxyUrl = import.meta.env.VITE_TTS_PROXY_URL?.trim();
  const nativeHttpBaseUrl = resolveNativeHttpBaseUrl();
  const localDevFallbackUrl = 'http://localhost:8788';

  if (explicitTtsProxyUrl) {
    candidates.push(normalizeBaseUrl(explicitTtsProxyUrl));
  }
  candidates.push(nativeHttpBaseUrl);

  if (import.meta.env.DEV) {
    candidates.push(localDevFallbackUrl);
  }

  return [...new Set(candidates)];
}

function shouldFallbackToNextBaseUrl(error: unknown): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  if (error instanceof TtsHttpError) {
    return error.status === 404 || error.status === 502 || error.status === 503 || error.status === 504;
  }
  return error instanceof TypeError;
}

async function requestSynthesizeAtBaseUrl(
  baseUrl: string,
  body: TtsRequestBody,
  signal?: AbortSignal
): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers.authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${baseUrl}/api/tts/synthesize`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let errorText = `TTS request failed with status ${response.status}`;
    try {
      const errorPayload = await response.json();
      if (typeof errorPayload?.error === 'string') {
        errorText = errorPayload.error;
      }
    } catch (error) {
      // ignored: fallback to status based message
      logger.debug('TTS', 'Failed to parse error response:', error);
    }
    throw new TtsHttpError(response.status, errorText);
  }

  const audioBlob = await response.blob();
  if (!audioBlob.size) {
    throw new Error('Received empty TTS audio blob');
  }
  return audioBlob;
}

export async function synthesizeSpeech(
  text: string,
  scene: TtsScene,
  messageId?: string,
  signal?: AbortSignal
): Promise<Blob> {
  const body: TtsRequestBody = {
    text,
    scene,
    messageId,
  };

  const baseUrls = resolveTtsBaseUrls();
  let lastError: unknown = null;

  for (let index = 0; index < baseUrls.length; index += 1) {
    const baseUrl = baseUrls[index];
    if (!baseUrl) continue;
    try {
      return await requestSynthesizeAtBaseUrl(baseUrl, body, signal);
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }

      lastError = error;
      const hasNextCandidate = index < baseUrls.length - 1;
      if (hasNextCandidate && shouldFallbackToNextBaseUrl(error)) {
        continue;
      }
      throw error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('TTS request failed: no available endpoint');
}
