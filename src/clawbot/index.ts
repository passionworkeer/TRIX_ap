/**
 * Clawbot Gateway 集成模块
 *
 * 基于 Clawdbot Gateway 集成指南 v1.0.0
 * 提供完整的类型定义、服务和 Hooks
 *
 * @example
 * ```typescript
 * // 导入所有 Clawbot 相关功能
 * import {
 *   // 类型
 *   PairingRequest,
 *   PairingResponse,
 *   ConnectionStatus,
 *   // 服务
 *   ClawbotPairingService,
 *   // Hooks
 *   useClawbot,
 * } from '@/clawbot';
 *
 * // 使用服务
 * const pairing = new ClawbotPairingService({
 *   gatewayUrl: 'ws://localhost:18789',
 *   authToken: 'your-token',
 * });
 *
 * // 开始配对
 * const request = await pairing.generatePairingRequest('My Device');
 * ```
 */

// ============================================
// 类型定义
// ============================================
export * from '../types/clawbot';

// ============================================
// 服务
// ============================================
export { ClawbotPairingService, default as clawbotPairingService } from '../services/clawbotPairingService';

// ============================================
// Contexts & Hooks
// ============================================
export {
  WebSocketProvider,
  useGlobalConnection,
} from '../contexts/WebSocketContext';

export {
  QRCodePairingProvider,
  useQRCodePairing,
} from '../contexts/QRCodePairingContext';

// ============================================
// 统一 Hook（方便使用）
// ============================================

import { useGlobalConnection } from '../contexts/WebSocketContext';
import { useQRCodePairing } from '../contexts/QRCodePairingContext';

/**
 * 统一 Clawbot Hook
 *
 * 整合 WebSocket 连接和配对功能
 *
 * @example
 * ```typescript
 * const {
 *   // 连接状态
 *   isConnected,
 *   status,
 *   fullResponse,
 *   sendMessage,
 *   // 配对状态
 *   isPairing,
 *   pairingStatus,
 *   startPairing,
 * } = useClawbot();
 * ```
 */
export const useClawbot = () => {
  const ws = useGlobalConnection();
  const pairing = useQRCodePairing();

  return {
    // WebSocket
    connectionStatus: ws.status,
    isConnected: ws.isConnected,
    fullResponse: ws.fullResponse,
    currentStreamId: ws.currentStreamId,
    sendMessage: ws.sendMessage,
    connect: ws.connect,
    disconnect: ws.disconnect,
    lastError: ws.lastError,
    reconnectCount: ws.reconnectCount,

    // Pairing
    isPairing: pairing.isPairing,
    pairingRequest: pairing.pairingRequest,
    pairingStatus: pairing.pairingStatus,
    deviceToken: pairing.deviceToken,
    pairingError: pairing.errorMessage,
    qrCodeContent: pairing.qrCodeContent,
    startPairing: pairing.startPairing,
    cancelPairing: pairing.cancelPairing,
    resetPairing: pairing.resetPairing,
  };
};
