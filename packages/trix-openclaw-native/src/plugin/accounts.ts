import path from 'node:path';
import type { PluginAccountConfig, ResolvedPluginAccount } from '../types.js';

const DEFAULT_ACCOUNT_ID = 'default';

function readChannelConfig(cfg: Record<string, unknown>): Record<string, unknown> | undefined {
  // OpenClaw may pass either:
  // 1. Full config with channels.trix-native
  // 2. Direct channel config (trix-native)
  const channels = cfg.channels as Record<string, unknown> | undefined;
  const fromChannels = channels?.['trix-native'] as Record<string, unknown> | undefined;
  if (fromChannels) return fromChannels;

  // Check if config is passed directly
  if (cfg.accounts) return cfg as Record<string, unknown>;

  return undefined;
}

function resolveAccountConfig(cfg: Record<string, unknown>, accountId = DEFAULT_ACCOUNT_ID): PluginAccountConfig | undefined {
  const channel = readChannelConfig(cfg);
  const accounts = channel?.accounts as Record<string, PluginAccountConfig> | undefined;
  return accounts?.[accountId];
}

export function listAccountIds(cfg: Record<string, unknown>): string[] {
  const channel = readChannelConfig(cfg);
  const accounts = channel?.accounts as Record<string, PluginAccountConfig> | undefined;
  const ids = Object.keys(accounts ?? {});
  return ids.length > 0 ? ids : [DEFAULT_ACCOUNT_ID];
}

export function resolveAccount(cfg: Record<string, unknown>, accountId = DEFAULT_ACCOUNT_ID): ResolvedPluginAccount {
  const channel = readChannelConfig(cfg);
  const configured = resolveAccountConfig(cfg, accountId);
  const storageDir = configured?.storageDir ?? path.resolve('.trix-native-channel/openclaw');

  return {
    accountId,
    enabled: configured?.enabled ?? Boolean(channel?.enabled ?? configured),
    configured: Boolean(configured?.serverUrl && configured?.adminToken),
    name: configured?.name ?? 'TRIX Native',
    serverUrl: configured?.serverUrl ?? '',
    publicBaseUrl: configured?.publicBaseUrl,
    adminToken: configured?.adminToken,
    serviceToken: configured?.serviceToken,
    storageDir,
  };
}

export function defaultAccountId(cfg: Record<string, unknown>): string {
  const channel = readChannelConfig(cfg);
  return (channel?.defaultAccount as string | undefined) ?? DEFAULT_ACCOUNT_ID;
}

export function applyAccountConfig(params: {
  cfg: Record<string, unknown>;
  accountId: string;
  input: Record<string, unknown>;
}): Record<string, unknown> {
  const channel = readChannelConfig(params.cfg) ?? {};
  const channels = (params.cfg.channels as Record<string, unknown> | undefined) ?? {};
  const accounts = (channel.accounts as Record<string, unknown> | undefined) ?? {};

  return {
    ...params.cfg,
    channels: {
      ...channels,
      'trix-native': {
        ...channel,
        enabled: true,
        accounts: {
          ...accounts,
          [params.accountId]: {
            accountId: params.accountId,
            enabled: true,
            name: (params.input.name as string | undefined) ?? 'TRIX Native',
            serverUrl: params.input.serverUrl,
            publicBaseUrl: params.input.publicBaseUrl,
            adminToken: params.input.adminToken,
            serviceToken: params.input.serviceToken as string | undefined,
            storageDir: params.input.storageDir,
          },
        },
      },
    },
  };
}
