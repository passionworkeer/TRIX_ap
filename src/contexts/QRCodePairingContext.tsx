import React, { createContext, useContext, useState, useCallback } from 'react';
import clawbotPairingService from '../services/clawbotPairingService';
import { logger } from '../utils/logger';
import { PairingRequest, PairingResponse } from '../types/clawbot';

/**
 * 二维码配对 Context
 * 
 * 提供全局配对状态管理和操作方法
 */

interface QRCodePairingContextType {
  // 状态
  isPairing: boolean;
  pairingRequest: PairingRequest | null;
  pairingStatus: PairingResponse['status'] | null;
  deviceToken: string | null;
  errorMessage: string | null;
  qrCodeContent: string | null;

  // 操作
  startPairing: (deviceName?: string) => Promise<void>;
  cancelPairing: () => Promise<void>;
  resetPairing: () => void;
}

const QRCodePairingContext = createContext<QRCodePairingContextType | undefined>(undefined);

export const QRCodePairingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPairing, setIsPairing] = useState(false);
  const [pairingRequest, setPairingRequest] = useState<PairingRequest | null>(null);
  const [pairingStatus, setPairingStatus] = useState<PairingResponse['status'] | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrCodeContent, setQRCodeContent] = useState<string | null>(null);

  /**
   * 开始配对流程
   */
  const startPairing = useCallback(async (deviceName?: string) => {
    try {
      setIsPairing(true);
      setErrorMessage(null);
      setPairingStatus('pending');

      // 从 localStorage 获取用户输入的 Gateway 配置
      const savedGatewayUrl = localStorage.getItem('clawbot_gateway_url');
      const pairingToken = localStorage.getItem('clawbot_pairing_token');

      // 更新 service 的 gatewayUrl（用户可能输入了新的配对码）
      if (savedGatewayUrl) {
        clawbotPairingService.setGatewayUrl(savedGatewayUrl);
        logger.pairing.debug('[QRCodePairing] 使用用户输入的 Gateway:', savedGatewayUrl);
      }

      // 1. 生成配对请求（传入 pairingToken 用于自动确认模式）
      logger.pairing.debug('[QRCodePairing] 生成配对请求...');
      const request = await clawbotPairingService.generatePairingRequest(deviceName, pairingToken || undefined);
      setPairingRequest(request);

      // 如果请求已经被自动确认（Gateway 直接返回了 device_token）
      if (request.status === 'approved' && request.device_token) {
        logger.pairing.debug('[QRCodePairing] ✅ Gateway 自动确认，配对成功！');
        setPairingStatus('approved');
        setDeviceToken(request.device_token);
        setIsPairing(false);
        // 保存 gateway_url 以便自动重连
        if (savedGatewayUrl) {
          localStorage.setItem('clawbot_gateway_url', savedGatewayUrl);
        }
        return;
      }

      // 2. 生成二维码内容（用于手动扫码场景）
      const qrContent = clawbotPairingService.getQRCodeContent(request.requestId);
      setQRCodeContent(qrContent);
      logger.pairing.debug('[QRCodePairing] 二维码内容已生成');

      // 3. 开始轮询配对状态（使用 Gateway HTTP API 替代 Supabase）
      logger.pairing.debug('[QRCodePairing] 开始轮询配对状态...');
      await clawbotPairingService.pollPairingStatusViaGateway(
        request.requestId,
        (response: PairingResponse) => {
          logger.pairing.debug('[QRCodePairing] 状态更新:', response);
          setPairingStatus(response.status);

          if (response.status === 'approved') {
            // 配对成功
            setDeviceToken(response.deviceToken || null);
            setIsPairing(false);

            // 保存 token 到内存（通过 setDeviceToken），保存 gateway_url 到 localStorage
            if (response.deviceToken) {
              if (savedGatewayUrl) {
                localStorage.setItem('clawbot_gateway_url', savedGatewayUrl);
              }
              logger.pairing.debug('[QRCodePairing] ✅ 配对成功！Token 已保存');
            }
          } else if (response.status === 'denied' || response.status === 'cancelled' || response.status === 'expired') {
            // 配对失败
            setErrorMessage(response.message || '配对失败');
            setIsPairing(false);
          }
        }
      );
    } catch (error) {
      logger.pairing.error('[QRCodePairing] 配对失败:', error);
      setErrorMessage(error instanceof Error ? error.message : '配对失败，请重试');
      setIsPairing(false);
      setPairingStatus('denied');
    }
  }, []);

  /**
   * 取消配对
   */
  const cancelPairing = useCallback(async () => {
    if (pairingRequest) {
      try {
        logger.pairing.debug('[QRCodePairing] 取消配对...');
        await clawbotPairingService.cancelPairingRequest(pairingRequest.requestId);
        setIsPairing(false);
        setPairingStatus('cancelled');
      } catch (error) {
        logger.pairing.error('[QRCodePairing] 取消配对失败:', error);
        setErrorMessage('取消配对失败');
      }
    }
  }, [pairingRequest]);

  /**
   * 重置配对状态
   */
  const resetPairing = useCallback(() => {
    setIsPairing(false);
    setPairingRequest(null);
    setPairingStatus(null);
    setDeviceToken(null);
    setErrorMessage(null);
    setQRCodeContent(null);
  }, []);

  return (
    <QRCodePairingContext.Provider
      value={{
        isPairing,
        pairingRequest,
        pairingStatus,
        deviceToken,
        errorMessage,
        qrCodeContent,
        startPairing,
        cancelPairing,
        resetPairing
      }}
    >
      {children}
    </QRCodePairingContext.Provider>
  );
};

/**
 * Hook: 使用二维码配对上下文
 */
export const useQRCodePairing = () => {
  const context = useContext(QRCodePairingContext);
  if (!context) {
    throw new Error('useQRCodePairing 必须在 QRCodePairingProvider 内部使用');
  }
  return context;
};
