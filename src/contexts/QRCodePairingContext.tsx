import React, { createContext, useContext, useState, useCallback } from 'react';
import clawbotPairingService, { PairingRequest, PairingResponse } from '../services/clawbotPairingService';

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

      // 1. 生成配对请求
      console.log('[QRCodePairing] 生成配对请求...');
      const request = await clawbotPairingService.generatePairingRequest(deviceName);
      setPairingRequest(request);

      // 2. 生成二维码内容
      const qrContent = clawbotPairingService.getQRCodeContent(request.requestId);
      setQRCodeContent(qrContent);
      console.log('[QRCodePairing] 二维码内容已生成');

      // 3. 开始轮询配对状态
      console.log('[QRCodePairing] 开始轮询配对状态...');
      await clawbotPairingService.pollPairingStatus(
        request.requestId,
        (response: PairingResponse) => {
          console.log('[QRCodePairing] 状态更新:', response);
          setPairingStatus(response.status);

          if (response.status === 'approved') {
            // 配对成功
            setDeviceToken(response.deviceToken || null);
            setIsPairing(false);
            
            // 保存 token 到 localStorage
            if (response.deviceToken) {
              localStorage.setItem('clawbot_device_token', response.deviceToken);
              console.log('[QRCodePairing] ✅ 配对成功！Token 已保存');
            }
          } else if (response.status === 'denied' || response.status === 'cancelled' || response.status === 'expired') {
            // 配对失败
            setErrorMessage(response.message || '配对失败');
            setIsPairing(false);
          }
        }
      );
    } catch (error) {
      console.error('[QRCodePairing] 配对失败:', error);
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
        console.log('[QRCodePairing] 取消配对...');
        await clawbotPairingService.cancelPairingRequest(pairingRequest.requestId);
        setIsPairing(false);
        setPairingStatus('cancelled');
      } catch (error) {
        console.error('[QRCodePairing] 取消配对失败:', error);
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
