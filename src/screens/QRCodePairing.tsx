import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle, Keyboard, Loader, Scan } from 'lucide-react';
import { AppRoutes } from '../types';
import QRScanner from '../components/QRScanner';
import { useNotification } from '../hooks/useNotification';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';

const PAIRING_CODE_PATTERN = /^[A-Z0-9]{6,8}$/;

const QRCodePairing: React.FC = () => {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const { isPaired, pairWithCode, pairWithQR, lastError } = useClawbotChannel();

  const [manualCode, setManualCode] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isPaired) {
      showSuccess('配对成功，正在返回首页');
      const timer = setTimeout(() => {
        navigate(AppRoutes.HOME);
      }, 1200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isPaired, navigate, showSuccess]);

  const handleManualPairing = async () => {
    const normalizedCode = manualCode.trim().toUpperCase();
    if (!PAIRING_CODE_PATTERN.test(normalizedCode)) {
      showError('请输入 6 到 8 位字母数字配对码');
      return;
    }

    try {
      setLoading(true);
      const success = await pairWithCode(normalizedCode);
      if (!success) {
        showError('配对码无效或已过期');
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : '配对失败');
    } finally {
      setLoading(false);
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    try {
      setLoading(true);
      const success = await pairWithQR(decodedText);
      if (!success) {
        showError('二维码配对失败');
      }
      setShowScanner(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : '二维码配对失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-20 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="ios-pressable ios-surface-button rounded-xl p-2 text-slate-700 dark:text-slate-200"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">TRIX Native 配对</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="ios-glass-surface mb-6 rounded-2xl border border-slate-200 p-8 shadow-lg dark:border-slate-800"
        >
          <div className="flex flex-col items-center space-y-4 text-center">
            {isPaired ? (
              <CheckCircle className="h-16 w-16 text-green-500" />
            ) : loading ? (
              <Loader className="h-16 w-16 animate-spin text-indigo-500" />
            ) : (
              <Scan className="h-16 w-16 text-indigo-500" />
            )}

            <div>
              <h2 className="mb-2 text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                {isPaired ? '已连接' : '连接 Clawbot'}
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                扫描桌面端二维码，或直接输入桌面端显示的配对码。
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="ios-glass-surface space-y-4 rounded-2xl border border-slate-200 p-6 shadow-lg dark:border-slate-800"
        >
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="ios-pressable ios-primary-button flex w-full items-center justify-center gap-2 rounded-xl py-3 text-white"
            disabled={loading}
          >
            <Scan className="h-5 w-5" />
            扫描二维码
          </button>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              手动输入配对码
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8))}
                placeholder="AB12CD34"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono tracking-[0.25em] text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                maxLength={8}
              />
              <button
                type="button"
                onClick={() => void handleManualPairing()}
                className="ios-pressable rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white disabled:opacity-50"
                disabled={loading || !PAIRING_CODE_PATTERN.test(manualCode.trim().toUpperCase())}
              >
                <Keyboard className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <AlertCircle className="h-4 w-4" />
              使用说明
            </div>
            <ol className="space-y-1.5 pl-5 list-decimal">
              <li>在电脑端启动 `trix-openclaw-native` 服务并创建配对码。</li>
              <li>手机端扫码时优先使用二维码；网络不方便时可手输配对码。</li>
              <li>绑定后会保留会话信息，刷新网页后会自动恢复。</li>
            </ol>
          </div>

          {lastError && (
            <p className="text-center text-sm text-red-500">{lastError}</p>
          )}
        </motion.div>
      </div>

      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={(decodedText) => {
          void handleScanSuccess(decodedText);
        }}
        onScanError={(message) => showError(message)}
      />
    </div>
  );
};

export default QRCodePairing;
