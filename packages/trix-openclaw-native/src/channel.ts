import type { ChannelPlugin } from 'openclaw/plugin-sdk/core';
import { applyTrixAccountConfig, inspectTrixAccount, listTrixAccountIds, resolveDefaultTrixAccountId, resolveRegisteredTrixAccount, resolveTrixAccount } from './account.js';
import { looksLikeTrixTarget, normalizeTrixTarget } from './bindings.js';
import { monitorTrixProvider } from './monitor.js';
import { trixOutbound } from './outbound.js';
import { probeTrix } from './probe.js';
import { trixSetupAdapter } from './setup.js';

const pendingPairingCodeByAccount = new Map<string, string>();
const PAIRING_STATUS_POLL_INTERVAL_MS = 7_000;
const DEFAULT_PAIRING_WAIT_TIMEOUT_MS = 5 * 60_000;
type RuntimeSnapshot = {
  running?: boolean;
  connected?: boolean;
  lastError?: string | null;
  lastConnectedAt?: number | null;
  lastInboundAt?: number | null;
  lastOutboundAt?: number | null;
};

async function createServicePairing(accountId?: string | null) {
  const account = resolveRegisteredTrixAccount(accountId);
  const response = await fetch(`${account.serviceUrl.replace(/\/$/, '')}/api/pairings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${account.serviceToken ?? ''}`,
    },
    body: JSON.stringify({
      accountId: account.accountId,
      label: account.name,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create pairing QR: ${response.status} ${response.statusText}`);
  }
  const payload = await response.json() as { code: string; claimUrl?: string; qrDataUrl?: string };
  pendingPairingCodeByAccount.set(account.accountId, payload.code);
  return { account, payload };
}

async function waitForServicePairing(accountId?: string | null, timeoutMs?: number) {
  const account = resolveRegisteredTrixAccount(accountId);
  const pairingCode = pendingPairingCodeByAccount.get(account.accountId);
  if (!pairingCode) {
    return { connected: false, message: 'No pending TRIX pairing request.' };
  }

  const startedAt = Date.now();
  const effectiveTimeoutMs = timeoutMs ?? DEFAULT_PAIRING_WAIT_TIMEOUT_MS;
  while (Date.now() - startedAt < effectiveTimeoutMs) {
    try {
      const response = await fetch(`${account.serviceUrl.replace(/\/$/, '')}/api/pairings/${encodeURIComponent(pairingCode)}`, {
        headers: {
          authorization: `Bearer ${account.serviceToken ?? ''}`,
        },
      });
      if (!response.ok) {
        if (response.status >= 500 && response.status < 600) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error(`Failed to poll pairing status: ${response.status} ${response.statusText}`);
      }
      const pairing = await response.json() as { status?: string };
      if (pairing.status === 'paired') {
        pendingPairingCodeByAccount.delete(account.accountId);
        return { connected: true, message: 'TRIX device paired.' };
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Failed to poll pairing status:')) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, PAIRING_STATUS_POLL_INTERVAL_MS));
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, PAIRING_STATUS_POLL_INTERVAL_MS));
  }

  pendingPairingCodeByAccount.delete(account.accountId);
  return { connected: false, message: 'Timed out waiting for TRIX pairing.' };
}

export const trixPlugin: ChannelPlugin = {
  id: 'trix-native',
  meta: {
    id: 'trix-native',
    label: 'Trix Native',
    selectionLabel: 'Trix Native',
    docsPath: '/channels/trix-native',
    docsLabel: 'trix-native',
    blurb: 'TRIX service-backed native channel plugin',
    aliases: ['trix'],
    order: 75,
  },
  capabilities: {
    chatTypes: ['direct'],
    polls: false,
    threads: true,
    media: true,
    reactions: false,
    edit: false,
    reply: true,
  },
  reload: { configPrefixes: ['channels.trix-native'] },
  gatewayMethods: ['web.login.start', 'web.login.wait'],
  configSchema: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        enabled: { type: 'boolean' },
        defaultAccount: { type: 'string' },
        dmPolicy: { type: 'string', enum: ['open', 'pairing', 'allowlist', 'disabled'] },
        accounts: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            additionalProperties: false,
            properties: {
              enabled: { type: 'boolean' },
              name: { type: 'string' },
              serviceUrl: { type: 'string', format: 'uri' },
              publicBaseUrl: { type: 'string', format: 'uri' },
              serviceToken: { type: 'string' },
              transport: { type: 'string', enum: ['ws', 'http'] },
              storageDir: { type: 'string' },
            },
            required: ['serviceUrl', 'serviceToken'],
          },
        },
      },
    },
    uiHints: {
      'accounts.default.serviceUrl': {
        label: 'Service URL',
        placeholder: 'http://127.0.0.1:8788',
      },
      'accounts.default.serviceToken': {
        label: 'Service Token',
        sensitive: true,
      },
    },
  },
  config: {
    listAccountIds: (cfg) => listTrixAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveTrixAccount({ cfg, accountId }),
    inspectAccount: (cfg, accountId) => inspectTrixAccount({ cfg, accountId }),
    defaultAccountId: (cfg) => resolveDefaultTrixAccountId(cfg),
    isEnabled: (account) => account.enabled,
    isConfigured: (account) => account.configured,
    setAccountEnabled: ({ cfg, accountId, enabled }) =>
      applyTrixAccountConfig({
        cfg,
        accountId,
        input: {
          ...(resolveTrixAccount({ cfg, accountId }) as unknown as Record<string, unknown>),
          enabled,
        },
      }),
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      name: account.name,
      baseUrl: account.serviceUrl,
    }),
  },
  setup: trixSetupAdapter,
  security: {
    resolveDmPolicy: () => ({
      policy: 'open',
      allowFrom: ['*'],
      allowFromPath: 'channels.trix-native.allowFrom',
      approveHint: 'TRIX service claim controls user access',
    }),
  },
  auth: {
    login: async ({ accountId, runtime, verbose }) => {
      const { payload } = await createServicePairing(accountId);
      const logger = runtime as { log?: (message: string) => void };
      logger.log?.(`TRIX pairing code: ${payload.code}`);
      if (payload.claimUrl) {
        logger.log?.(`TRIX claim URL: ${payload.claimUrl}`);
      }
      if (payload.qrDataUrl && verbose) {
        logger.log?.(`TRIX QR data URL: ${payload.qrDataUrl}`);
      }

      const result = await waitForServicePairing(accountId, DEFAULT_PAIRING_WAIT_TIMEOUT_MS);
      logger.log?.(result.message);
      if (!result.connected) {
        throw new Error(result.message);
      }
    },
  },
  messaging: {
    normalizeTarget: (raw) => normalizeTrixTarget(raw) ?? undefined,
    targetResolver: {
      looksLikeId: looksLikeTrixTarget,
      hint: '<conv:<id>|user:<id>>',
    },
  },
  agentPrompt: {
    messageToolHints: () => [
      '- TRIX Native replies route through the Trix Service service plane.',
      '- Prefer implicit replies in the current session or explicit `conv:<conversationId>` targets.',
    ],
  },
  outbound: trixOutbound,
  status: {
    defaultRuntime: {
      accountId: 'default',
      configured: false,
      running: false,
      connected: false,
    },
    probeAccount: async ({ account }) => await probeTrix(account as { accountId: string; serviceUrl: string; serviceToken?: string | null }),
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: (account as { accountId: string }).accountId,
      enabled: (account as { enabled: boolean }).enabled,
      configured: (account as { configured: boolean }).configured,
      name: (account as { name: string }).name,
      running: (runtime as RuntimeSnapshot | undefined)?.running ?? false,
      connected: (runtime as RuntimeSnapshot | undefined)?.connected ?? false,
      lastError: (runtime as RuntimeSnapshot | undefined)?.lastError ?? null,
      lastConnectedAt: (runtime as RuntimeSnapshot | undefined)?.lastConnectedAt ?? null,
      lastInboundAt: (runtime as RuntimeSnapshot | undefined)?.lastInboundAt ?? null,
      lastOutboundAt: (runtime as RuntimeSnapshot | undefined)?.lastOutboundAt ?? null,
      probe,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = resolveTrixAccount({ cfg: ctx.cfg, accountId: ctx.accountId });
      ctx.setStatus({
        accountId: ctx.accountId,
        connected: false,
        running: true,
        configured: account.configured,
      });
      return await monitorTrixProvider({
        config: ctx.cfg as Record<string, unknown>,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
        accountId: ctx.accountId,
        statusSink: (next) => ctx.setStatus({ accountId: ctx.accountId, ...(next as Record<string, unknown>) }),
        channelRuntime: ctx.channelRuntime as Parameters<typeof monitorTrixProvider>[0]['channelRuntime'],
      });
    },
    loginWithQrStart: async ({ accountId, timeoutMs }) => {
      const { payload } = await createServicePairing(accountId);
      return {
        qrDataUrl: payload.qrDataUrl,
        message: `Use pairing code ${payload.code}${payload.claimUrl ? ` or visit ${payload.claimUrl}` : ''}`,
      };
    },
    loginWithQrWait: async ({ accountId, timeoutMs }) => await waitForServicePairing(accountId, timeoutMs),
  },
};

export function createTrixNativePlugin(): ChannelPlugin {
  return trixPlugin;
}
