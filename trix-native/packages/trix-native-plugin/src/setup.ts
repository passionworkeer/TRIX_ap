// ============================================
// TRIX Native Setup - CLI 配置命令
// ============================================

import { execSync } from 'child_process';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { TrixNativeAPI } from './api.js';

/**
 * 默认服务器地址
 */
const DEFAULT_SERVER = 'http://TRIX_SERVER_HOST:8788';

/**
 * 运行设置流程
 */
export async function runSetup(api: OpenClawPluginApi): Promise<void> {
  console.log('='.repeat(50));
  console.log('TRIX Native Channel 设置');
  console.log('='.repeat(50));

  // 使用默认服务器地址
  const serverUrl = DEFAULT_SERVER;
  console.log('服务器地址:', serverUrl);

  const trixApi = new TrixNativeAPI(serverUrl);

  try {
    // 1. 创建配对码
    console.log('正在创建配对码...');
    const pairing = await trixApi.createPairing();

    console.log('');
    console.log('='.repeat(50));
    console.log('配对码:', pairing.code);
    console.log('='.repeat(50));
    console.log('');
    console.log('请在手机 TRIX App 中输入此配对码');
    console.log('配对码有效期:', pairing.expiresIn, '秒');
    console.log('');

    // 2. 轮询等待手机扫码配对
    const deadline = Date.now() + pairing.expiresIn * 1000;

    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        const status = await trixApi.getPairingStatus(pairing.code);

        if (status.status === 'paired' && status.deviceId) {
          // 3. 认领配对
          const claim = await trixApi.claimPairing(
            pairing.code,
            status.deviceId,
            'OpenClaw Gateway'
          );

          console.log('');
          console.log('配对成功！');
          console.log('='.repeat(50));

          // 4. 自动写入 OpenClaw 配置
          try {
            console.log('正在写入配置...');

            // 设置 serverUrl
            execSync(
              `openclaw config set channels.trix-native.accounts.default.serverUrl "${serverUrl}"`,
              { stdio: 'ignore' }
            );

            // 设置 token（通过 runtime.credentials）
            await (api as any).runtime.credentials.set('trix-native', {
              token: claim.pluginToken,
              refreshToken: claim.refreshToken,
              deviceId: claim.deviceId,
              serverUrl
            });

            console.log('配置已自动写入');
          } catch (configError) {
            console.log('自动写入配置失败，请手动执行:');
            console.log(`  openclaw config set channels.trix-native.accounts.default.serverUrl "${serverUrl}"`);
          }

          console.log('');
          console.log('设置完成！请运行以下命令重启网关:');
          console.log('  openclaw gateway restart');
          console.log('');
          console.log('='.repeat(50));

          return;
        }

        if (status.status === 'expired') {
          console.log('配对码已过期，请重新运行 setup');
          return;
        }
      } catch (error) {
        // 继续等待
      }
    }

    console.log('配对超时，请重新运行 setup');
  } catch (error) {
    console.error('连接服务器失败:', error);
    console.log('请检查服务器是否运行:', serverUrl);
  }
}
