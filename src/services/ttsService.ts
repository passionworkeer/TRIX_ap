import { getClawbotEndpoints } from '../config/clawbotEndpoints';

export type TtsScene = 'welcome' | 'status' | 'bot_reply';

interface TtsRequestBody {
  text: string;
  scene: TtsScene;
  messageId?: string;
}

function resolveTtsBaseUrl(): string {
  const { channelUrl } = getClawbotEndpoints();
  if (!channelUrl) {
    throw new Error('Clawbot channel URL is not configured');
  }

  const parsed = new URL(channelUrl);
  parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
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

  const response = await fetch(`${resolveTtsBaseUrl()}/api/tts/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
    } catch {
      // ignored: fallback to status based message
    }
    throw new Error(errorText);
  }

  const audioBlob = await response.blob();
  if (!audioBlob.size) {
    throw new Error('Received empty TTS audio blob');
  }
  return audioBlob;
}
