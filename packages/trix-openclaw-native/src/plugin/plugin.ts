import path from 'node:path';
import type { ResolvedPluginAccount } from '../types.js';
import { applyAccountConfig, defaultAccountId, listAccountIds, resolveAccount } from './accounts.js';
import { createOutboundAdapter } from './outbound.js';
import { startInboundMonitor } from './inbound.js';
import { buildRuntimeAccountStatusSnapshot, buildProbeChannelStatusSummary, createDefaultChannelRuntimeState } from 'openclaw/plugin-sdk';

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
        const setStatus = ctx.setStatus as ((status: { accountId: string; port?: number }) => void) | undefined;
        log.info?.('[trix] ctx keys: ' + Object.keys(ctx).join(', '));

        // 只设置 port，不设置 running - Gateway 根据 port 是否为 null 来判断是否 running
        setStatus?.({ accountId: ctx.accountId as string, port: 8788 });
        log.info?.('[trix] setStatus called with port=8788');

        // 检查是否有预解析的 account 对象
        const preResolvedAccount = ctx.account as ResolvedPluginAccount | undefined;
        const account = preResolvedAccount
          ? preResolvedAccount
          : (() => {
              const resolved = resolveAccount(ctx.cfg as Record<string, unknown>, ctx.accountId as string | undefined);
              return {
                ...resolved,
                storageDir: resolved.storageDir || path.resolve('.trix-native-channel/openclaw'),
              };
            })();

        if (preResolvedAccount) {
          log.info?.('[trix] using pre-resolved account from ctx: serverUrl=' + (preResolvedAccount.serverUrl ? '(set)' : '(EMPTY)') + ', adminToken=' + (preResolvedAccount.adminToken ? '(set)' : '(EMPTY)'));
        } else {
          log.info?.('[trix] resolved from cfg: configured=' + account.configured + ', serverUrl=' + (account.serverUrl ? '(set)' : '(EMPTY)') + ', adminToken=' + (account.adminToken ? '(set)' : '(EMPTY)'));
        }

        log.info?.(`[trix] starting monitor for ${account.accountId}`);

        // 启动 WebSocket 长连接
        await startInboundMonitor(ctx, account);

        // 返回 teardown 函数 —— 这是关键！
        // abortSignal 已经在 startInboundMonitor 内部监听了，
        // 此处返回一个函数让 Gateway 也能主动触发清理
        return () => {
          log.info?.(`[trix] teardown called for ${account.accountId}`);
          // activeMonitors 的清理已在 abortSignal abort 事件里处理
        };
      },
    },
    outbound: createOutboundAdapter(),
    status: {
      defaultRuntime: createDefaultChannelRuntimeState('default', { port: null }) as Record<string, unknown>,
      buildChannelSummary: ({ snapshot }: { snapshot: Record<string, unknown> }) =>
        buildProbeChannelStatusSummary(snapshot, {
          port: snapshot.port ?? null,
        }),
      buildAccountSnapshot: ({ account, runtime, probe }: { account: Record<string, unknown>; runtime: Record<string, unknown> | undefined; probe: unknown }) => {
        // 派生 running 状态：从 port 是否为 null 来判断
        const port = runtime?.port ?? null;
        return {
          accountId: account.accountId,
          enabled: account.enabled,
          configured: account.configured,
          name: account.name,
          port,
          ...buildRuntimeAccountStatusSnapshot({ runtime, probe }),
          // running 必须在 spread 之后，以覆盖 buildRuntimeAccountStatusSnapshot 返回的 running
          running: port !== null,
        };
      },
    },
  };
}
