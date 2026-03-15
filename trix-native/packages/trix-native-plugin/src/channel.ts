// ============================================
// TRIX Native Channel 定义
// ============================================

import type { ChannelPlugin, OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { TrixNativeAPI } from './api.js';
import { saveCredentials } from './credentials.js';
import { getDeviceName } from './utils.js';
import type { PluginCredentials, TrixNativeConfig } from './types.js';

/**
 * 解析 account 配置
 */
function resolveAccount(cfg: any, accountId?: string): TrixNativeConfig {
  const account = cfg.channels?.trixNative?.accounts?.[accountId ?? 'default'];

  if (!account) {
    throw new Error(`Account ${accountId} not found. Please configure trixNative channel.`);
  }

  return {
    accountId: accountId ?? 'default',
    name: account.name ?? 'TRIX Native',
    serverUrl: account.serverUrl
  };
}

/**
 * 执行配对流程
 */
async function performPairing(
  trixApi: TrixNativeAPI,
  deviceName: string,
  onStatusChange?: (status: string) => void
): Promise<PluginCredentials> {
  // 1. 创建配对码
  onStatusChange?.('creating');
  const pairing = await trixApi.createPairing();

  console.log(`[TRIX Native] Pairing code: ${pairing.code}`);

  // 2. 轮询等待手机配对
  onStatusChange?.('waiting');
  let attempts = 0;
  const maxAttempts = 100; // 5分钟 (100 * 3s)

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const status = await trixApi.getPairingStatus(pairing.code);

      if (status.status === 'paired' && status.deviceId) {
        // 3. 认领配对
        onStatusChange?.('claiming');
        const claim = await trixApi.claimPairing(
          pairing.code,
          status.deviceId,
          deviceName
        );

        // 4. 保存凭证
        const credentials: PluginCredentials = {
          version: '1.0',
          accountId: 'default',
          serverUrl: trixApi.getServerUrl(),
          deviceId: claim.deviceId,
          pluginToken: claim.pluginToken,
          refreshToken: claim.refreshToken,
          pairedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + claim.expiresIn * 1000).toISOString()
        };

        await saveCredentials(credentials);
        return credentials;
      }
    } catch (error) {
      // 配对未完成，继续等待
    }

    attempts++;
  }

  throw new Error('配对超时，请重试');
}

// Channel Plugin 定义
export const trixNativeChannel: ChannelPlugin = {
  id: 'trix-native',

  meta: {
    id: 'trix-native',
    label: 'TRIX Native',
    selectionLabel: 'TRIX Native (手机配对)',
    docsPath: '/channels/trix-native',
    blurb: '通过配对码或QR码连接TRIX手机App,支持完整多模态消息',
    aliases: ['trix', 'native', 'phone']
  },

  capabilities: {
    chatTypes: ['direct'],
    media: true,
    polls: false,
    threads: false,
    reactions: false,
    edit: false,
    reply: true
  },

  config: {
    listAccountIds: (cfg) => {
      return Object.keys(cfg.channels?.trixNative?.accounts ?? {});
    },

    resolveAccount: (cfg, accountId) => {
      return resolveAccount(cfg, accountId ?? undefined);
    }
  }
};

// 注册插件
export default function registerPlugin(api: OpenClawPluginApi) {
  console.log('[TRIX Native] Registering channel plugin...');

  // 注册 channel
  api.registerChannel({
    plugin: trixNativeChannel
  });

  // 注册配对服务
  api.registerService({
    id: 'trix-native-pairing',

    start: async (serviceApi: any) => {
      // 读取配置
      const account = resolveAccount(serviceApi.config, 'default');
      const trixApi = new TrixNativeAPI(account.serverUrl);

      // 获取设备名称
      const deviceName = await getDeviceName();

      // 执行配对
      await performPairing(trixApi, deviceName, (status) => {
        console.log(`[TRIX Native] Pairing status: ${status}`);
      });
    }
  });
}
