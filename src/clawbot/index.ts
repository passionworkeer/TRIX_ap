/**
 * Clawbot Gateway 集成模块
 *
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
 *   // Hooks
 *   useClawbotChannel,
 * } from '@/clawbot';
 *
 * // 使用 Channel
 * const { isConnected, sendMessage, pairWithCode, pairWithQR } = useClawbotChannel();
 * ```
 */

// ============================================
// 类型定义
// ============================================
export * from '../types/clawbot';
