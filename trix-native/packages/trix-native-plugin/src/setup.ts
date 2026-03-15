// ============================================
// TRIX Native Setup - CLI 配置命令
// ============================================

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { TrixNativeAPI } from './api.js';

/**
 * 运行设置流程
 */
export async function runSetup(api: OpenClawPluginApi): Promise<void> {
  console.log('='.repeat(50));
  console.log('TRIX Native Channel 设置');
  console.log('='.repeat(50));

  // 读取现有配置
  const config = api.config as any;
  const existingChannel = config.channels?.['trix-native'];

  if (existingChannel?.accounts?.default?.serverUrl) {
    console.log('当前配置:');
    console.log('  Server URL:', existingChannel.accounts.default.serverUrl);
    console.log('');
  }

  // 提示用户配置服务器 URL
  console.log('请在 OpenClaw 配置文件中设置服务器 URL:');
  console.log('');
  console.log('在 openclaw.yaml 或配置文件中添加:');
  console.log(`
channels:
  trix-native:
    enabled: true
    accounts:
      default:
        name: TRIX Native
        serverUrl: http://你的服务器IP:8788
`);
  console.log('');
  console.log('配置完成后，运行:');
  console.log('  openclaw gateway restart');
  console.log('  openclaw trix setup');
  console.log('');
  console.log('='.repeat(50));

  // 尝试创建配对码（如果已配置服务器）
  try {
    const account = config.channels?.['trix-native']?.accounts?.default;

    if (account?.serverUrl) {
      console.log('检测到服务器配置，正在创建配对码...');

      const trixApi = new TrixNativeAPI(account.serverUrl);
      const pairing = await trixApi.createPairing();

      console.log('');
      console.log('='.repeat(50));
      console.log('配对码:', pairing.code);
      console.log('='.repeat(50));
      console.log('');
      console.log('请在手机 TRIX App 中输入此配对码完成配对');
      console.log('');
    }
  } catch (error) {
    console.log('无法连接到服务器，请检查配置');
  }
}
