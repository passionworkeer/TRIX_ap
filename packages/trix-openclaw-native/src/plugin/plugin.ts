import path from 'node:path';
import type { ResolvedPluginAccount } from '../types.js';
import { applyAccountConfig, defaultAccountId, listAccountIds, resolveAccount } from './accounts.js';
import { createOutboundAdapter } from './outbound.js';
import { startInboundMonitor } from './inbound.js';

export function createTrixNativePlugin() {
  const pendingPairingCodeByAccount = new Map<string, string>();

  return {
    id: 'trix-native',
    meta: {
      id: 'trix-native',
      label: 'TRIX Native',
      selectionLabel: 'TRIX Native Channel',
      docsPath: '/channels/trix-native',
      docsLabel: 'trix-native',
      blurb: 'TRIX pairing + QR + LAN + multimodal native channel.',
      aliases: ['trixchat', 'trix-native'],
      order: 75,
    },
    capabilities: {
      chatTypes: ['direct'],
      polls: false,
      threads: false,
      media: true,
      reactions: false,
      edit: false,
      reply: true,
    },
    config: {
      listAccountIds,
      resolveAccount,
      defaultAccountId,
      isEnabled: (account: { enabled: boolean }) => account.enabled,
      isConfigured: (account: { configured: boolean }) => account.configured,
      describeAccount: (account: { accountId: string; enabled: boolean; configured: boolean; name: string; serverUrl: string }) => ({
        accountId: account.accountId,
        enabled: account.enabled,
        configured: account.configured,
        name: account.name,
        baseUrl: account.serverUrl,
      }),
    },
    configSchema: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          enabled: { type: 'boolean' },
          defaultAccount: { type: 'string' },
          accounts: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              additionalProperties: false,
              required: ['serverUrl', 'adminToken'],
              properties: {
                enabled: { type: 'boolean' },
                name: { type: 'string' },
                serverUrl: { type: 'string', format: 'uri' },
                publicBaseUrl: { type: 'string', format: 'uri' },
                adminToken: { type: 'string' },
                storageDir: { type: 'string' },
              },
            },
          },
        },
      },
    },
    setup: {
      resolveAccountId: ({ accountId }: { accountId?: string }) => accountId ?? 'default',
      applyAccountConfig: ({ cfg, accountId, input }: { cfg: Record<string, unknown>; accountId: string; input: Record<string, unknown> }) =>
        applyAccountConfig({ cfg, accountId, input }),
    },
    pairing: {
      idLabel: 'deviceId',
      normalizeAllowEntry: (entry: string) => entry.trim(),
    },
    messaging: {
      normalizeTarget: (raw: string) => raw.trim() || undefined,
      targetResolver: {
        looksLikeId: (raw: string) => /^conv_/i.test(raw.trim()),
        hint: '<conversationId>',
      },
    },
    agentPrompt: {
      messageToolHints: () => [
        '- TRIX Native target uses the conversation id returned by pairing.',
        '- TRIX Native supports text, images, audio, video, and generic files.',
      ],
    },
    gateway: {
      loginWithQrStart: async (params: { cfg: Record<string, unknown>; accountId?: string; timeoutMs?: number }) => {
        const account = resolveAccount(params.cfg, params.accountId ?? undefined);
        const accountKey = account.accountId;
        const response = await fetch(`${account.serverUrl.replace(/\/$/, '')}/api/pairings`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-trix-admin-token': account.adminToken ?? '',
          },
          body: JSON.stringify({
            label: account.name,
            ttlMs: params.timeoutMs,
          }),
        });
        if (!response.ok) {
          throw new Error(`Failed to create pairing QR: ${response.status} ${response.statusText}`);
        }
        const pairing = await response.json() as { code: string; claimUrl: string; qrDataUrl?: string };
        pendingPairingCodeByAccount.set(accountKey, pairing.code);
        return {
          qrDataUrl: pairing.qrDataUrl,
          message: `Use pairing code ${pairing.code} or scan the QR to join ${pairing.claimUrl}`,
        };
      },
      loginWithQrWait: async (params: { cfg: Record<string, unknown>; accountId?: string; timeoutMs?: number }) => {
        const account = resolveAccount(params.cfg, params.accountId ?? undefined);
        const accountKey = account.accountId;
        const pairingCode = pendingPairingCodeByAccount.get(accountKey);
        if (!pairingCode) {
          return { connected: false, message: 'No pending TRIX Native QR pairing.' };
        }

        const startedAt = Date.now();
        const timeoutMs = params.timeoutMs ?? 60_000;
        while (Date.now() - startedAt < timeoutMs) {
          const response = await fetch(`${account.serverUrl.replace(/\/$/, '')}/api/pairings/${encodeURIComponent(pairingCode)}`, {
            headers: {
              'x-trix-admin-token': account.adminToken ?? '',
            },
          });
          if (!response.ok) {
            throw new Error(`Failed to poll pairing status: ${response.status} ${response.statusText}`);
          }
          const pairing = await response.json() as { status?: string };
          if (pairing.status === 'paired') {
            pendingPairingCodeByAccount.delete(accountKey);
            return { connected: true, message: 'TRIX Native device paired.' };
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        pendingPairingCodeByAccount.delete(accountKey);
        return { connected: false, message: 'Timed out waiting for TRIX Native pairing.' };
      },
      startAccount: async (ctx: Record<string, unknown>) => {
        const log = (ctx.log as { info?: (msg: string) => void; warn?: (msg: string) => void; error?: (msg: string) => void } | undefined) ?? {};
        log.info?.('[trix] ctx keys: ' + Object.keys(ctx).join(', '));

        // 检查是否有预解析的 account 对象
        const preResolvedAccount = ctx.account as ResolvedPluginAccount | undefined;
        if (preResolvedAccount) {
          log.info?.('[trix] using pre-resolved account from ctx: serverUrl=' + (preResolvedAccount.serverUrl ? '(set)' : '(EMPTY)') + ', adminToken=' + (preResolvedAccount.adminToken ? '(set)' : '(EMPTY)'));
          await startInboundMonitor(ctx, preResolvedAccount);
          return;
        }

        // 否则从配置解析
        const account = resolveAccount(ctx.cfg as Record<string, unknown>, ctx.accountId as string | undefined);
        log.info?.('[trix] resolved from cfg: configured=' + account.configured + ', serverUrl=' + (account.serverUrl ? '(set)' : '(EMPTY)') + ', adminToken=' + (account.adminToken ? '(set)' : '(EMPTY)'));
        const effectiveAccount = {
          ...account,
          storageDir: account.storageDir || path.resolve('.trix-native-channel/openclaw'),
        };
        await startInboundMonitor(ctx, effectiveAccount);
      },
    },
    outbound: createOutboundAdapter(),
    status: {
      defaultRuntime: {
        accountId: 'default',
        configured: false,
        running: false,
        connected: false,
      },
      buildChannelSummary: ({ snapshot }: { snapshot: Record<string, unknown> }) => ({
        configured: snapshot.configured ?? false,
        running: snapshot.running ?? false,
        connected: snapshot.connected ?? false,
        lastError: snapshot.lastError ?? null,
      }),
    },
  };
}
