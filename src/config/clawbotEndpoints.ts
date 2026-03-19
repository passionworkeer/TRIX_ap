const DEV_DEFAULT_NATIVE_SERVER_URL = 'http://localhost:8788';

export interface ClawbotEndpoints {
  nativeServerUrl: string;
  nativePublicUrl: string;
}

function cleanValue(value: string | undefined): string {
  return value?.trim() ?? '';
}

function pickValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const cleaned = cleanValue(value);
    if (cleaned.length > 0) {
      return cleaned;
    }
  }

  return '';
}

function withDevFallback(value: string, fallback: string): string {
  if (value.length > 0) {
    return value;
  }

  return import.meta.env.DEV ? fallback : '';
}

export function maskSecret(secret: string | undefined | null): string {
  if (!secret) {
    return '';
  }

  if (secret.length <= 8) {
    return '***';
  }

  return `${secret.slice(0, 4)}***${secret.slice(-4)}`;
}

export function getClawbotEndpoints(): ClawbotEndpoints {
  const nativeServerUrl = withDevFallback(
    pickValue(
      import.meta.env.VITE_TRIX_NATIVE_SERVER_URL,
      import.meta.env.VITE_TRIX_NATIVE_PUBLIC_URL,
    ),
    DEV_DEFAULT_NATIVE_SERVER_URL,
  );

  const nativePublicUrl = withDevFallback(
    pickValue(
      import.meta.env.VITE_TRIX_NATIVE_PUBLIC_URL,
      import.meta.env.VITE_TRIX_NATIVE_SERVER_URL,
    ),
    DEV_DEFAULT_NATIVE_SERVER_URL,
  );

  return {
    nativeServerUrl,
    nativePublicUrl,
  };
}
