// ============================================
// TRIX Native Plugin 入口
// ============================================

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { trixNativeChannel } from './channel.js';
import { startMonitor } from './monitor.js';
import { runSetup } from './setup.js';

// 注册插件
export default function register(api: OpenClawPluginApi) {
  console.log('[TRIX Native] Registering channel plugin...');

  // 注册 channel
  api.registerChannel({ plugin: trixNativeChannel });

  // 注册 CLI 命令: openclaw trix setup
  api.registerCli(({ program }: any) => {
    program
      .command('trix')
      .description('TRIX Native commands')
      .action(() => {
        // 这个会被子命令覆盖
      });

    program
      .command('trix setup')
      .description('Setup TRIX Native channel')
      .action(() => runSetup(api));
  }, { commands: ['trix', 'trix setup'] });

  // 注册后台 WebSocket 监听服务 (inbound)
  api.registerService({
    id: 'trix-native-monitor',
    start: async (ctx: any) => {
      await startMonitor(api, ctx);
    },
    stop: () => {
      // 关闭 WebSocket 连接
      console.log('[TRIX Native] Monitor service stopped');
    }
  });
}

// 导出类型
export type {
  TrixNativeConfig,
  PluginCredentials,
  TrixMessage,
  Attachment,
  CreatePairingResponse,
  PairingStatusResponse,
  ClaimPairingResponse,
  SendToPhoneRequest,
  SendToPhoneResponse,
  GetMessagesResponse,
  UploadResponse,
  ChannelContext,
  OutboundMessage
} from './types.js';
