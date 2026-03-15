// ============================================
// 内存存储服务 (开发/测试用)
// 生产环境建议使用 Redis
// ============================================

import type { Pairing, Message, Device } from '../types.js';

// 内存存储
class MemoryStore {
  pairings: Map<string, Pairing> = new Map();
  messages: Map<string, Message[]> = new Map();
  devices: Map<string, Device> = new Map();
  phoneConnections: Map<string, string> = new Map(); // socketId -> pairingCode
  pluginConnections: Map<string, string> = new Map(); // socketId -> deviceId
  agentConnections: Map<string, string> = new Map(); // socketId -> accountId
  userConnections: Map<string, { conversationId: string; clientId: string }> = new Map(); // socketId -> { conversationId, clientId }

  // 清理过期配对
  cleanup(): void {
    const now = new Date();
    for (const [code, pairing] of this.pairings) {
      if (pairing.expiresAt < now && pairing.status !== 'paired') {
        pairing.status = 'expired';
      }
    }
  }
}

export const store = new MemoryStore();

// 定期清理
setInterval(() => store.cleanup(), 60 * 1000); // 每分钟清理一次
