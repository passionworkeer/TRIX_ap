/**
 * 二维码配对 Context
 *
 * 已废弃：配对逻辑已迁移到 ClawbotChannelContext + TrixNativeChannelClient。
 * 此 Context 保留为空实现以避免破坏性变更。
 * 请使用 useClawbotChannel() 代替。
 */
import React, { createContext, useContext, type ReactNode } from 'react';

interface QRCodePairingContextType {
  isPairing: boolean;
  pairingRequest: null;
  pairingStatus: null;
  deviceToken: null;
  errorMessage: null;
  qrCodeContent: null;
  startPairing: () => Promise<void>;
  cancelPairing: () => Promise<void>;
  resetPairing: () => void;
}

const QRCodePairingContext = createContext<QRCodePairingContextType | undefined>(undefined);

export const QRCodePairingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const value: QRCodePairingContextType = {
    isPairing: false,
    pairingRequest: null,
    pairingStatus: null,
    deviceToken: null,
    errorMessage: null,
    qrCodeContent: null,
    startPairing: async () => {},
    cancelPairing: async () => {},
    resetPairing: () => {},
  };

  return (
    <QRCodePairingContext.Provider value={value}>
      {children}
    </QRCodePairingContext.Provider>
  );
};

export const useQRCodePairing = () => {
  const context = useContext(QRCodePairingContext);
  if (!context) {
    throw new Error('useQRCodePairing 必须在 QRCodePairingProvider 内部使用');
  }
  return context;
};
