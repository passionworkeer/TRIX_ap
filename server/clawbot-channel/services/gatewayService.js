/**
 * Gateway Service - CLI 方式
 *
 * 使用 openclaw CLI 调用 Gateway，支持会话记忆
 */

const { exec } = require('child_process');

// CLI 命令 - 新版本用 openclaw 而不是 openclaw-cn
const OPENCLAW_CLI = 'openclaw';

class GatewayService {
  constructor() {
    this.connected = false;
  }

  async connect() {
    this.connected = true;
    console.log('[GatewayService] Gateway ready (CLI mode)');
    return;
  }

  async sendChatMessage(message, sessionKey = 'agent:main:main') {
    const sessionId = sessionKey.split(':').pop() || 'main';

    return new Promise((resolve, reject) => {
      // 使用 openclaw agent 命令，--no-color 避免 ANSI 颜色代码
      const cmd = `${OPENCLAW_CLI} agent --message "${message.replace(/"/g, '\\"')}" --session-id ${sessionId} --json --no-color`;

      console.log('[GatewayService] Running:', cmd);

      exec(cmd, { shell: true }, (error, stdout, stderr) => {
        if (error) {
          console.error('[GatewayService] CLI error:', stderr || error.message);
          reject(new Error(`CLI error: ${stderr || error.message}`));
          return;
        }

        try {
          // 找到 JSON 开始的位置（只找 { 开头，因为 JSON 是对象格式）
          const jsonStart = stdout.indexOf('{');
          if (jsonStart === -1) {
            throw new Error('No JSON found in output');
          }
          const jsonStr = stdout.slice(jsonStart);

          const result = JSON.parse(jsonStr);

          // 获取所有消息（payloads 可能是数组）
          const payloads = result.result?.payloads || result.payloads || [];
          console.log('[GatewayService] <- response payloads count:', payloads.length);

          // 返回完整结果，让调用者处理多条消息
          resolve(result);
        } catch (e) {
          console.error('[GatewayService] Failed to parse CLI output:', stdout.slice(0, 300));
          reject(e);
        }
      });
    });
  }

  close() {
    this.connected = false;
  }
}

module.exports = new GatewayService();
