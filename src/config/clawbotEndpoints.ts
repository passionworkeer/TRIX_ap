const DEFAULT_CHANNEL_URL = 'ws://localhost:8765';
const DEFAULT_GATEWAY_URL = 'ws://localhost:18789';

export interface ClawbotEndpoints {
  channelUrl: string;
  gatewayUrl: string;
  gatewayToken: string;
}

function cleanUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
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
  const channelUrl = cleanUrl(
    import.meta.env.VITE_CLAWBOT_CHANNEL_URL,
    DEFAULT_CHANNEL_URL
  );

  const gatewayUrl = cleanUrl(
    import.meta.env.VITE_GATEWAY_WS_URL || import.meta.env.VITE_CLAWBOT_GATEWAY_URL,
    DEFAULT_GATEWAY_URL
  );

  const gatewayToken = cleanUrl(
    import.meta.env.VITE_GATEWAY_AUTH_TOKEN || import.meta.env.VITE_CLAWBOT_GATEWAY_TOKEN,
    ''
  );

  return { channelUrl, gatewayUrl, gatewayToken };
}
