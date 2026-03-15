// ============================================
// TRIX Native Channel 定义
// ============================================

import type { ChannelPlugin } from 'openclaw/plugin-sdk';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { TrixNativeAPI } from './api.js';
import type { TrixNativeConfig } from './types.js';

/**
 * 解析 account 配置
 */
function resolveAccount(cfg: any, accountId?: string): TrixNativeConfig {
  const account = cfg.channels?.['trix-native']?.accounts?.[accountId ?? 'default'];

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
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      return Object.keys(cfg.channels?.['trix-native']?.accounts ?? {});
    },

    resolveAccount: (cfg, accountId) => {
      return resolveAccount(cfg, accountId ?? 'default');
    }
  },

  // Outbound: 发送消息到手机
  outbound: {
    deliveryMode: 'direct',

    // 发送文本消息
    sendText: async (ctx: any) => {
      const { text, conversation, account } = ctx;
      const acc = account as any;
      console.log(`[TRIX Native] Sending text: ${conversation.id}`);

      const trixApi = new TrixNativeAPI(acc.serverUrl);

      await trixApi.sendToPhone(
        {
          conversationId: conversation.id,
          text
        },
        acc.token
      );

      return { ok: true, channel: 'trix-native', messageId: `msg_${Date.now()}` };
    },

    // 发送媒体消息
    sendMedia: async (ctx: any) => {
      const { mediaUrl, mimeType, conversation, account } = ctx;
      const acc = account as any;
      console.log(`[TRIX Native] Sending media: ${conversation.id}`);

      const trixApi = new TrixNativeAPI(acc.serverUrl);

      // 1. 下载媒体内容
      const response = await fetch(mediaUrl!);
      const blob = await response.blob();

      // 2. 上传到服务器
      const uploadResult = await trixApi.uploadFile(
        blob,
        'attachment',
        'file',
        acc.token
      );

      // 3. 发消息
      await trixApi.sendToPhone(
        {
          conversationId: conversation.id,
          attachments: [{
            type: 'file',
            url: uploadResult.url,
            mimeType: mimeType || blob.type,
            size: uploadResult.size
          }]
        },
        acc.token
      );

      return { ok: true, channel: 'trix-native', messageId: `msg_${Date.now()}` };
    }
  }
};

// 导出配对函数供外部调用
export async function runPairing(api: OpenClawPluginApi): Promise<void> {
  const config = api.config as any;
  const account = config.channels?.['trix-native']?.accounts?.default;

  if (!account?.serverUrl) {
    throw new Error('请先配置 TRIX Native 服务器地址');
  }

  const serverUrl = account.serverUrl;
  const trixApi = new TrixNativeAPI(serverUrl);

  // 1. 创建配对码
  const pairing = await trixApi.createPairing();

  console.log('='.repeat(50));
  console.log('TRIX Native 配对码:', pairing.code);
  console.log('请在手机 App 中输入此配对码');
  console.log('='.repeat(50));

  // 2. 轮询等待手机扫码
  const deadline = Date.now() + pairing.expiresIn * 1000;

  while (Date.now() < deadline) {
    await sleep(3000);

    try {
      const status = await trixApi.getPairingStatus(pairing.code);

      if (status.status === 'paired' && status.deviceId) {
        const claim = await trixApi.claimPairing(
          pairing.code,
          status.deviceId,
          'OpenClaw Gateway'
        );

        console.log('[TRIX Native] Pairing successful!');

        // 写入凭证
        await (api as any).runtime.credentials.set('trix-native', {
          token: claim.pluginToken,
          refreshToken: claim.refreshToken,
          deviceId: claim.deviceId,
          serverUrl
        });

        return;
      }

      if (status.status === 'expired') {
        throw new Error('配对码已过期');
      }
    } catch (error) {
      // 继续等待
    }
  }

  throw new Error('配对超时，请重试');
}
