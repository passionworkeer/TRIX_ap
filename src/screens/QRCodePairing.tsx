import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scan,
  Wifi,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Loader,
} from 'lucide-react';
import { useQRCodePairing } from '../contexts/QRCodePairingContext';
import { logger } from '../utils/logger';
import { AppRoutes } from '../types';
import QRScanner from '../components/QRScanner';
import clawbotPairingService from '../services/clawbotPairingService';
import { useNotification } from '../hooks/useNotification';

interface PairingStatusInfo {
  title: string;
  message: string;
  color: string;
}

const asString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeQRCodePayload = (rawData: Record<string, unknown>) => {
  return {
    gatewayUrl: asString(rawData.gatewayUrl) || asString(rawData.gateway_url) || asString(rawData.g),
    pairingToken: asString(rawData.pairingToken) || asString(rawData.pairing_token) || asString(rawData.t),
    deviceId: asString(rawData.deviceId) || asString(rawData.device_id),
    expiresAt: asString(rawData.expiresAt) || asString(rawData.expires_at),
    mode: asString(rawData.mode) || asString(rawData.m) || asString(rawData.clientMode),
    version: asString(rawData.version),
  };
};

const QRCodePairing: React.FC = () => {
  const { showError } = useNotification();
  const navigate = useNavigate();
  const {
    isPairing,
    pairingStatus,
    deviceToken,
    errorMessage,
    startPairing,
    cancelPairing,
    resetPairing,
  } = useQRCodePairing();

  const [manualCode, setManualCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [showManualInput, setShowManualInput] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (pairingStatus === 'approved' && deviceToken) {
      const timer = setTimeout(() => {
        navigate(AppRoutes.HOME);
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [pairingStatus, deviceToken, navigate]);

  const getDeviceName = () => {
    return deviceName.trim() || `TRIX-${navigator.platform}`;
  };

  const validatePayloadOrThrow = (gatewayUrl?: string, pairingToken?: string) => {
    if (!gatewayUrl) {
      throw new Error('配对码缺少必要字段 gatewayUrl 或 gateway_url');
    }
    if (!pairingToken) {
      throw new Error('配对码缺少必要字段 pairingToken 或 pairing_token');
    }
  };

  const savePairingPayload = (payload: {
    gatewayUrl: string;
    pairingToken: string;
    deviceId?: string;
  }) => {
    localStorage.setItem('clawbot_gateway_url', payload.gatewayUrl);
    localStorage.setItem('clawbot_pairing_token', payload.pairingToken);

    if (payload.deviceId) {
      localStorage.setItem('clawbot_device_id', payload.deviceId);
    }
  };

  const handleManualPairing = async () => {
    try {
      const rawData = JSON.parse(manualCode.trim()) as Record<string, unknown>;
      const payload = normalizeQRCodePayload(rawData);
      validatePayloadOrThrow(payload.gatewayUrl, payload.pairingToken);

      savePairingPayload({
        gatewayUrl: payload.gatewayUrl!,
        pairingToken: payload.pairingToken!,
        deviceId: payload.deviceId,
      });

      logger.pairing.debug('[QRCodePairing] 配对信息已保存', {
        gatewayUrl: payload.gatewayUrl,
        hasToken: Boolean(payload.pairingToken),
        deviceId: payload.deviceId,
        expiresAt: payload.expiresAt,
        version: payload.version,
      });

      if (payload.mode === 'webchat') {
        clawbotPairingService.directConnect(payload.gatewayUrl!, payload.pairingToken!);
        navigate(AppRoutes.HOME);
        return;
      }

      await startPairing(getDeviceName());
      setManualCode('');
      setShowManualInput(false);
    } catch (error) {
      logger.pairing.error('[QRCodePairing] 处理配对码失败:', error);
      showError(error instanceof Error ? error.message : '配对码格式错误，请检查后重试');
    }
  };

  const handleStartPairing = async () => {
    await startPairing(getDeviceName());
  };

  const handleScanSuccess = async (decodedText: string) => {
    try {
      const rawData = JSON.parse(decodedText) as Record<string, unknown>;
      const payload = normalizeQRCodePayload(rawData);
      validatePayloadOrThrow(payload.gatewayUrl, payload.pairingToken);

      savePairingPayload({
        gatewayUrl: payload.gatewayUrl!,
        pairingToken: payload.pairingToken!,
        deviceId: payload.deviceId,
      });

      await startPairing(getDeviceName());
      setShowScanner(false);
    } catch (error) {
      logger.pairing.error('[QRCodePairing] 处理扫描结果失败:', error);
      showError(error instanceof Error ? error.message : '二维码格式错误，请重新扫描');
    }
  };

  const handleCancelPairing = async () => {
    await cancelPairing();
    resetPairing();
  };

  const handleGoBack = () => {
    if (isPairing) {
      void handleCancelPairing();
    }
    navigate(-1);
  };

  const renderStatusIcon = () => {
    switch (pairingStatus) {
      case 'approved':
        return <CheckCircle className="h-20 w-20 text-green-500 dark:text-green-400" />;
      case 'denied':
      case 'cancelled':
        return <XCircle className="h-20 w-20 text-red-500 dark:text-red-400" />;
      case 'expired':
        return <AlertCircle className="h-20 w-20 text-orange-500 dark:text-orange-400" />;
      case 'pending':
        return <Loader className="h-20 w-20 animate-spin text-blue-500 dark:text-blue-400" />;
      default:
        return <Wifi className="h-20 w-20 text-indigo-500 dark:text-indigo-400" />;
    }
  };

  const renderStatusMessage = (): PairingStatusInfo => {
    switch (pairingStatus) {
      case 'approved':
        return {
          title: '配对成功',
          message: '正在连接到 Clawbot Gateway…',
          color: 'text-green-700 dark:text-green-300',
        };
      case 'denied':
        return {
          title: '配对被拒绝',
          message: errorMessage || '电脑端拒绝了本次配对请求。',
          color: 'text-red-700 dark:text-red-300',
        };
      case 'cancelled':
        return {
          title: '配对已取消',
          message: '配对流程已中止。',
          color: 'text-slate-700 dark:text-slate-300',
        };
      case 'expired':
        return {
          title: '配对超时',
          message: errorMessage || '配对请求已过期，请重新发起配对。',
          color: 'text-orange-700 dark:text-orange-300',
        };
      case 'pending':
        return {
          title: '等待电脑端确认',
          message: '请在电脑端点击“允许”完成配对。',
          color: 'text-blue-700 dark:text-blue-300',
        };
      default:
        return {
          title: '连接 Clawbot',
          message: '请扫描二维码，或手动粘贴配对码。',
          color: 'text-indigo-700 dark:text-indigo-300',
        };
    }
  };

  const statusInfo = renderStatusMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-20 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={handleGoBack}
            className="rounded-lg p-2 text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Clawbot 配对</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-col items-center space-y-4 text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={pairingStatus || 'idle'}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {renderStatusIcon()}
              </motion.div>
            </AnimatePresence>

            <div>
              <h2 className={`mb-2 text-2xl font-bold ${statusInfo.color}`}>{statusInfo.title}</h2>
              <p className="text-slate-600 dark:text-slate-300">{statusInfo.message}</p>
            </div>

            {deviceToken && (
              <div className="mt-4 w-full rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/70 dark:bg-green-950/40">
                <p className="break-all font-mono text-sm text-green-700 dark:text-green-300">
                  Token: {deviceToken.substring(0, 20)}...
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {!isPairing && pairingStatus !== 'approved' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900/70 dark:bg-blue-950/40"
          >
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-200">
              <AlertCircle className="h-5 w-5" />
              配对步骤
            </h3>
            <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <span className="font-bold">1.</span>
                <span>在电脑上打开 Clawbot Gateway 并进入配对模式。</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">2.</span>
                <span>电脑端会显示二维码和配对码。</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">3.</span>
                <span>可扫描二维码，也可在下方手动粘贴配对码。</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">4.</span>
                <span>在电脑端点击“允许”完成配对。</span>
              </li>
            </ol>
          </motion.div>
        )}

        {!isPairing && pairingStatus !== 'approved' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                设备名称（可选）
              </label>
              <input
                type="text"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                placeholder="留空将自动生成"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 py-4 font-semibold text-white shadow-lg transition-all hover:from-indigo-700 hover:to-purple-700"
            >
              <Scan className="h-5 w-5" />
              扫描二维码配对
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">或</span>
              <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
            </div>

            <button
              type="button"
              onClick={() => setShowManualInput((prev) => !prev)}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 py-3 font-medium transition-colors ${
                showManualInput
                  ? 'border-indigo-300 bg-indigo-100 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'
                  : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Wifi className="h-4 w-4" />
              {showManualInput ? '收起手动输入' : '手动输入配对码（推荐）'}
            </button>

            <AnimatePresence>
              {showManualInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      配对码（从电脑端复制）
                    </label>

                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs dark:border-blue-900/70 dark:bg-blue-950/30">
                      <p className="mb-1 font-medium text-blue-900 dark:text-blue-200">示例格式（支持两种字段风格）</p>
                      <code className="mb-1 block overflow-x-auto rounded bg-blue-100 p-2 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                        {`{"gatewayUrl":"ws://192.168.1.100:18789","pairingToken":"abc123..."}`}
                      </code>
                      <code className="block overflow-x-auto rounded bg-blue-100 p-2 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                        {`{"gateway_url":"ws://192.168.1.100:18789","pairing_token":"abc123..."}`}
                      </code>
                    </div>

                    <textarea
                      value={manualCode}
                      onChange={(event) => setManualCode(event.target.value)}
                      placeholder="粘贴配对码…"
                      rows={4}
                      className="w-full resize-none rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />

                    {manualCode.trim() && (
                      <div className="text-xs">
                        {(() => {
                          try {
                            const rawData = JSON.parse(manualCode.trim()) as Record<string, unknown>;
                            const payload = normalizeQRCodePayload(rawData);
                            if (payload.gatewayUrl && payload.pairingToken) {
                              return (
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-300">
                                  <CheckCircle className="h-4 w-4" />
                                  <span>配对码格式正确</span>
                                </div>
                              );
                            }

                            const missingFields: string[] = [];
                            if (!payload.gatewayUrl) {
                              missingFields.push('gatewayUrl/gateway_url');
                            }
                            if (!payload.pairingToken) {
                              missingFields.push('pairingToken/pairing_token');
                            }

                            return (
                              <div className="flex items-center gap-1 text-orange-600 dark:text-orange-300">
                                <AlertCircle className="h-4 w-4" />
                                <span>缺少字段: {missingFields.join(', ')}</span>
                              </div>
                            );
                          } catch {
                            return (
                              <div className="flex items-center gap-1 text-red-600 dark:text-red-300">
                                <XCircle className="h-4 w-4" />
                                <span>JSON 格式错误</span>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleManualPairing}
                      disabled={!manualCode.trim()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
                    >
                      <Wifi className="h-4 w-4" />
                      使用配对码连接
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {isPairing && pairingStatus === 'pending' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <button
              type="button"
              onClick={handleCancelPairing}
              className="w-full rounded-lg bg-red-600 py-4 font-semibold text-white shadow-lg transition-colors hover:bg-red-700"
            >
              取消配对
            </button>
          </motion.div>
        )}

        {(pairingStatus === 'denied' || pairingStatus === 'expired') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
            <button
              type="button"
              onClick={() => {
                resetPairing();
                void handleStartPairing();
              }}
              className="w-full rounded-lg bg-indigo-600 py-4 font-semibold text-white shadow-lg transition-colors hover:bg-indigo-700"
            >
              重新配对
            </button>
          </motion.div>
        )}
      </div>

      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
        onScanError={(error) => {
          logger.pairing.error('[QRCodePairing] 扫描错误:', error);
        }}
      />
    </div>
  );
};

export default QRCodePairing;
