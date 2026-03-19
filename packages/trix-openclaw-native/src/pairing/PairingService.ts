import QRCode from 'qrcode';
import { randomId, randomPairingCode, randomToken, normalizePairingCode } from '../utils/ids.js';
import type {
  ConversationRecord,
  PairingClaimInput,
  PairingClaimResponse,
  PairingCreateInput,
  PairingCreatedResponse,
  PairingRecord,
} from '../types.js';
import { JsonStateStore } from '../storage/JsonStateStore.js';

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour - 足够时间扫描二维码

export class PairingService {
  constructor(private readonly store: JsonStateStore) {}

  async create(input: PairingCreateInput): Promise<PairingCreatedResponse> {
    const code = randomPairingCode();
    const secret = randomToken(18);
    const createdAt = Date.now();
    const expiresAt = createdAt + (input.ttlMs ?? DEFAULT_TTL_MS);
    const conversationId = randomId('conv', 10);
    const claimUrl = `${input.publicBaseUrl.replace(/\/$/, '')}/pair?code=${code}&secret=${secret}`;
    const qrDataUrl = await QRCode.toDataURL(claimUrl, { margin: 1, width: 320 });

    const pairing: PairingRecord = {
      code,
      secret,
      label: input.label,
      createdAt,
      expiresAt,
      status: 'pending',
      conversationId,
      claimUrl,
      qrDataUrl,
    };

    const conversation: ConversationRecord = {
      id: conversationId,
      createdAt,
      updatedAt: createdAt,
      pairingCode: code,
      openClawSessionKey: input.openClawSessionKey,
      participants: [],
    };

    await this.store.update((state) => ({
      ...state,
      pairings: [pairing, ...state.pairings.filter((entry) => entry.code !== code)],
      conversations: [conversation, ...state.conversations.filter((entry) => entry.id !== conversationId)],
    }));

    return {
      ...pairing,
      websocketUrl: `${input.publicBaseUrl.replace(/^http/i, 'ws').replace(/\/$/, '')}/ws`,
    };
  }

  async get(code: string): Promise<PairingRecord | undefined> {
    const normalized = normalizePairingCode(code);
    const state = await this.store.read();
    return state.pairings.find((entry) => entry.code === normalized);
  }

  async list(): Promise<PairingRecord[]> {
    const state = await this.store.read();
    return state.pairings;
  }

  async claim(input: PairingClaimInput, websocketUrl: string): Promise<PairingClaimResponse> {
    const normalized = normalizePairingCode(input.code);
    let claimedPairing: PairingRecord | undefined;
    const clientToken = randomToken(20);

    if (!input.secret?.trim()) {
      throw new Error('Pairing secret required');
    }

    await this.store.update((state) => {
      const pairings = state.pairings.map((entry) => {
        if (entry.code !== normalized) {
          return entry;
        }

        if (entry.expiresAt <= Date.now()) {
          throw new Error('Pairing code expired');
        }
        if (entry.secret !== input.secret) {
          throw new Error('Invalid pairing secret');
        }

        claimedPairing = {
          ...entry,
          status: 'paired',
          pairedAt: Date.now(),
          pairedClientId: input.clientId,
          pairedDeviceName: input.deviceName,
          clientToken,
        };
        return claimedPairing;
      });

      if (!claimedPairing) {
        throw new Error('Pairing code not found');
      }

      const conversations = state.conversations.map((conversation) => {
        if (conversation.id !== claimedPairing!.conversationId) {
          return conversation;
        }

        return {
          ...conversation,
          updatedAt: Date.now(),
          participants: [
            ...conversation.participants.filter((entry) => entry.clientId !== input.clientId),
            {
              clientId: input.clientId,
              deviceName: input.deviceName,
              role: 'user' as const,
              clientToken,
              connectedAt: Date.now(),
              lastSeenAt: Date.now(),
            },
          ],
        };
      });

      return {
        ...state,
        pairings,
        conversations,
      };
    });

    return {
      conversationId: claimedPairing!.conversationId,
      clientToken,
      websocketUrl,
      pairing: claimedPairing!,
    };
  }
}
