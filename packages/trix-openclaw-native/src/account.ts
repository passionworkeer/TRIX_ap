import path from 'node:path';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import type { PluginAccountConfig, ResolvedPluginAccount } from './types.js';

const DEFAULT_ACCOUNT_ID = 'default';
let pluginConfigProvider: (() => OpenClawConfig | Record<string, unknown>) | null = null;

type TrixConfigInput = OpenClawConfig | Record<string, unknown>;

function readChannelConfig(cfg: TrixConfigInput): Record<string, unknown> | undefined {
  const channels = (cfg as { channels?: Record<string, unknown> }).channels;
  const fromChannels = channels?.['trix-native'] as Record<string, unknown> | undefined;
  if (fromChannels) {
    return fromChannels;
  }
  if ((cfg as Record<string, unknown>).accounts) {
    return cfg as Record<string, unknown>;
  }
  return undefined;
}

function resolveAccountConfig(cfg: TrixConfigInput, accountId: string): PluginAccountConfig | undefined {
  const channel = readChannelConfig(cfg);
  const accounts = channel?.accounts as Record<string, PluginAccountConfig> | undefined;
  if (accountId === DEFAULT_ACCOUNT_ID) {
    return {
      accountId,
      enabled: (channel?.enabled as boolean | undefined) ?? true,
      name: (channel?.name as string | undefined) ?? 'TRIX Native',
      serviceUrl: channel?.serviceUrl as string | undefined,
      serverUrl: channel?.serverUrl as string | undefined,
      publicBaseUrl: channel?.publicBaseUrl as string | undefined,
      adminToken: channel?.adminToken as string | undefined,
      serviceToken: channel?.serviceToken as string | undefined,
      transport: (channel?.transport as 'ws' | 'http' | undefined) ?? 'ws',
      storageDir: channel?.storageDir as string | undefined,
      ...(accounts?.default ?? {}),
    };
  }
  return accounts?.[accountId];
}

export function setTrixPluginConfigProvider(provider: () => OpenClawConfig | Record<string, unknown>): void {
  pluginConfigProvider = provider;
}

export function getRegisteredTrixConfig(): OpenClawConfig | Record<string, unknown> {
  return pluginConfigProvider?.() ?? {};
}

export function listTrixAccountIds(cfg: TrixConfigInput): string[] {
  const channel = readChannelConfig(cfg);
  if (!channel) {
    return [];
  }
  const ids = new Set<string>(Object.keys((channel.accounts as Record<string, unknown> | undefined) ?? {}));
  if (channel.serviceUrl || channel.serverUrl || channel.serviceToken || channel.adminToken || ids.size === 0) {
    ids.add(DEFAULT_ACCOUNT_ID);
  }
  return [...ids];
}

export function resolveDefaultTrixAccountId(cfg: TrixConfigInput): string {
  const channel = readChannelConfig(cfg);
  return (channel?.defaultAccount as string | undefined) ?? DEFAULT_ACCOUNT_ID;
}

export function resolveTrixAccount(params: { cfg: TrixConfigInput; accountId?: string | null }): ResolvedPluginAccount {
  const accountId = params.accountId ?? resolveDefaultTrixAccountId(params.cfg);
  const channel = readChannelConfig(params.cfg);
  const configured = resolveAccountConfig(params.cfg, accountId);
  const serviceUrl = configured?.serviceUrl ?? configured?.serverUrl ?? '';
  const transport = configured?.transport ?? 'ws';
  const storageDir = configured?.storageDir ?? path.resolve('.trix-native-channel/openclaw');

  return {
    accountId,
    enabled: configured?.enabled ?? Boolean(channel?.enabled ?? configured),
    configured: Boolean(serviceUrl && configured?.serviceToken),
    name: configured?.name ?? 'TRIX Native',
    serviceUrl,
    publicBaseUrl: configured?.publicBaseUrl,
    adminToken: configured?.adminToken,
    serviceToken: configured?.serviceToken,
    transport,
    storageDir,
  };
}

export function resolveRegisteredTrixAccount(accountId?: string | null): ResolvedPluginAccount {
  return resolveTrixAccount({ cfg: getRegisteredTrixConfig(), accountId });
}

export function applyTrixAccountConfig(params: {
  cfg: TrixConfigInput;
  accountId: string;
  input: Record<string, unknown>;
}): OpenClawConfig {
  const channel = readChannelConfig(params.cfg) ?? {};
  const channels = ((params.cfg as { channels?: Record<string, unknown> }).channels ?? {}) as Record<string, unknown>;
  const accounts = (channel.accounts as Record<string, unknown> | undefined) ?? {};

  return {
    ...(params.cfg as OpenClawConfig),
    channels: {
      ...channels,
      'trix-native': {
        ...channel,
        enabled: true,
        dmPolicy: channel.dmPolicy ?? 'open',
        accounts: {
          ...accounts,
          [params.accountId]: {
            accountId: params.accountId,
            enabled: true,
            name: (params.input.name as string | undefined) ?? 'TRIX Native',
            serviceUrl: params.input.serviceUrl ?? params.input.serverUrl,
            publicBaseUrl: params.input.publicBaseUrl,
            serviceToken: params.input.serviceToken,
            adminToken: params.input.adminToken,
            transport: params.input.transport ?? 'ws',
            storageDir: params.input.storageDir,
          },
        },
      },
    },
  };
}

