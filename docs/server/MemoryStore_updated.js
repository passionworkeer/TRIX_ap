// ============================================
// 内存存储服务
// ============================================
class MemoryStore {
    pairings = new Map();
    messages = new Map();
    devices = new Map();
    phoneConnections = new Map();       // socketId -> pairingCode (Socket.IO)
    pluginConnections = new Map();       // socketId -> deviceId (Socket.IO)
    agentConnections = new Map();        // socketId -> accountId (Socket.IO)
    nativeAgentConnections = new Map();  // accountId -> Set<ws> (native WebSocket)

    cleanup() {
        const now = new Date();
        for (const [code, pairing] of this.pairings) {
            if (pairing.expiresAt < now && pairing.status !== 'paired') {
                pairing.status = 'expired';
            }
        }
    }
}
export const store = new MemoryStore();
setInterval(() => store.cleanup(), 60 * 1000);
