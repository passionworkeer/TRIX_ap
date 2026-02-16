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
  QRCodePairingProvider,
  useQRCodePairing,
} from '../contexts/QRCodePairingContext';
