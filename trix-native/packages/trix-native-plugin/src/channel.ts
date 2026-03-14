// ============================================
// TRIX Native Channel 定义
// ============================================

import type { ChannelPlugin, OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { TrixNativeAPI } from './api.js';
import { loadCredentials, saveCredentials, deleteCredentials } from './credentials.js';
import { performPairing, resumeConnection, disconnect } from './login.js';
import { getDeviceName } from './utils.js';
import type { PluginCredentials, TrixNativeConfig, OutboundMessage, TrixMessage } from './types.js';

// 轮询间隔
const POLL_INTERVAL = 3000; // 3秒

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
    media: true, // 支持多模态
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
  },

  // 登录/配对流程
  async login(ctx: { account: TrixNativeConfig; api: OpenClawPluginApi }) {
    const { account, api } = ctx;

    console.log('[TRIX Native] Starting login...');

    // 创建 API 客户端
    const trixApi = new TrixNativeAPI(account.serverUrl);

    // 显示配对界面
    try {
      const pairing = await trixApi.createPairing();

      // 显示配对信息
      api.ui.showPairingDialog({
        title: '连接 TRIX 手机',
        code: pairing.code,
        qrCode: pairing.qrDataUrl,
        expiresIn: pairing.expiresIn,
        instructions: [
          '在手机上打开 TRIX App',
          '点击"连接 OpenClaw"',
          '扫描此二维码或输入配对码'
        ]
      });

      // 轮询等待配对
      const deviceName = await getDeviceName();
      const credentials = await performPairing(trixApi, deviceName, (status) => {
        if (status === 'waiting') {
          console.log('[TRIX Native] Waiting for phone to pair...');
        }
      });

      api.ui.closePairingDialog();
      api.ui.showNotification({
        type: 'success',
        message: '手机已连接!'
      });

      return credentials;
    } catch (error) {
      api.ui.closePairingDialog();
      throw error;
    }
  },

  // 恢复连接
  async resume(ctx: { account: TrixNativeConfig; credentials: PluginCredentials }) {
    const { account, credentials } = ctx;

    console.log('[TRIX Native] Attempting to resume connection...');

    const trixApi = new TrixNativeAPI(account.serverUrl);
    const success = await resumeConnection(trixApi, credentials);

    if (!success) {
      throw new Error('无法恢复连接，请重新配对');
    }

    return { resumed: true };
  },

  // 断开连接
  async logout() {
    console.log('[TRIX Native] Logging out...');
    await disconnect();
  },

  // 发送消息到手机 (outbound)
  async sendMessage(ctx: {
    account: TrixNativeConfig;
    credentials: PluginCredentials;
    conversation: { id: string };
    message: OutboundMessage;
  }): Promise<{ sent: boolean }> {
    const { account, credentials, conversation, message } = ctx;

    console.log(`[TRIX Native] Sending message to phone: ${conversation.id}`);

    const trixApi = new TrixNativeAPI(account.serverUrl);

    // 1. 如果有附件，先上传
    const uploadedAttachments = [];

    if (message.attachments && message.attachments.length > 0) {
      for (const att of message.attachments) {
        try {
          // 下载附件内容
          const response = await fetch(att.url);
          const blob = await response.blob();

          // 上传到服务器
          const uploadResult = await trixApi.uploadFile(
            blob,
            att.fileName || 'attachment',
            att.type,
            credentials.pluginToken
          );

          uploadedAttachments.push({
            type: att.type,
            url: uploadResult.url,
            mimeType: att.mimeType || uploadResult.mimeType,
            fileName: att.fileName,
            size: uploadResult.size
          });
        } catch (error) {
          console.error('[TRIX Native] Failed to upload attachment:', error);
        }
      }
    }

    // 2. 发送消息到手机
    const result = await trixApi.sendToPhone(
      {
        conversationId: conversation.id,
        text: message.text,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined
      },
      credentials.pluginToken
    );

    console.log(`[TRIX Native] Message sent: ${result.messageId}`);

    return { sent: true };
  },

  // 接收手机消息 (inbound)
  async receiveMessages(ctx: {
    account: TrixNativeConfig;
    credentials: PluginCredentials;
    conversation: { id: string };
    lastMessageId?: string;
  }): Promise<{ messages: Array<{ id: string; timestamp: string; from: string; text?: string; attachments?: any[] }> }> {
    const { account, credentials, conversation, lastMessageId } = ctx;

    const trixApi = new TrixNativeAPI(account.serverUrl);

    const result = await trixApi.getMessages(
      conversation.id,
      credentials.pluginToken,
      lastMessageId
    );

    // 转换消息格式
    const messages = result.messages.map((msg: TrixMessage) => ({
      id: msg.id,
      timestamp: msg.timestamp,
      from: msg.from === 'phone' ? 'user' : 'agent',
      text: msg.text,
      attachments: msg.attachments
    }));

    return { messages };
  }
};

// 注册插件
export default function (api: OpenClawPluginApi) {
  console.log('[TRIX Native] Registering channel plugin...');
  api.registerChannel({ plugin: trixNativeChannel });
}
