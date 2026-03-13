import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Keyboard, Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { IMAGES } from '../constants';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { PAIRING_REQUIRED_TOAST_ID } from '../utils/pairingToast';
import { logger } from '../utils/logger';

const PAIRING_CODE_PATTERN = /^[A-Z0-9]{6,8}$/;

const Pairing: React.FC = () => {
  const navigate = useNavigate();
  const {
    isPaired,
    pairWithCode,
    pairWithQR,
    unpair,
    lastError,
  } = useClawbotChannel();

  const [mode, setMode] = useState<'scan' | 'input' | 'success'>('scan');
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanning = useRef(false);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  const stopScanner = async (clearDom: boolean = false) => {
    if (!scannerRef.current) {
      return;
    }

    if (isScanning.current) {
      try {
        await scannerRef.current.stop();
      } catch (error) {
        logger.pairing.error('Stop scanner failed:', error);
      }
    }

    isScanning.current = false;

    if (clearDom) {
      try {
        await scannerRef.current.clear();
      } catch (error) {
        logger.pairing.error('Clear scanner failed:', error);
      } finally {
        scannerRef.current = null;
      }
    }
  };

  const startScanner = async () => {
    try {
      await stopScanner();
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText: string) => {
          void handleScanSuccess(decodedText);
        },
        () => {
          // Ignore continuous parsing noise.
        },
      );

      isScanning.current = true;
      toast.success('摄像头已启动');
    } catch (error) {
      logger.pairing.error('Start scanner failed:', error);
      toast.error('无法访问摄像头，请检查权限设置');
    }
  };

  const handlePairSuccess = async () => {
    await stopScanner(true);
    toast.dismiss(PAIRING_REQUIRED_TOAST_ID);
    toast.success('配对成功');
    setMode('success');
    setTimeout(() => {
      navigate(AppRoutes.HOME);
    }, 1200);
  };

  const handleScanSuccess = async (decodedText: string) => {
    await stopScanner();
    setLoading(true);
    try {
      const success = await pairWithQR(decodedText.trim());
      if (!success) {
        toast.error('二维码配对失败');
        await startScanner();
        return;
      }
      await handlePairSuccess();
    } catch (error) {
      logger.pairing.error('QR pairing failed:', error);
      toast.error(error instanceof Error ? error.message : '二维码配对失败');
      await startScanner();
    } finally {
      setLoading(false);
    }
  };

  const handlePairWithCode = async () => {
    const normalizedCode = codeInput.trim().toUpperCase();
    if (!PAIRING_CODE_PATTERN.test(normalizedCode)) {
      toast.error('请输入 6 到 8 位字母数字配对码');
      return;
    }

    try {
      setLoading(true);
      const success = await pairWithCode(normalizedCode);
      if (!success) {
        toast.error('配对码无效或已过期');
        return;
      }
      await handlePairSuccess();
    } catch (error) {
      logger.pairing.error('Code pairing failed:', error);
      toast.error(error instanceof Error ? error.message : '配对失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUnpair = () => {
    void stopScanner(true);
    unpair();
    setMode('scan');
    setCodeInput('');
    toast.success('已取消配对');
  };

  useEffect(() => {
    if (isPaired) {
      setMode('success');
      void stopScanner(true);
    }
  }, [isPaired]);

  useEffect(() => {
    if (mode === 'scan') {
      void startScanner();
    } else {
      void stopScanner(true);
    }

    return () => {
      void stopScanner(true);
    };
  }, [mode]);

  useEffect(() => {
    if (mode === 'input') {
      codeInputRef.current?.focus();
    }
  }, [mode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf2ff] via-[#f8fbff] to-[#eef8ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-6 pb-10 pt-16">
        <button
          type="button"
          onClick={() => {
            void stopScanner(true);
            navigate(-1);
          }}
          className="ios-pressable ios-surface-button absolute left-4 top-12 flex h-11 w-11 items-center justify-center rounded-full shadow-sm"
          aria-label="返回"
        >
          <ArrowLeft size={22} className="text-slate-700" />
        </button>

        <div className="mt-8 flex flex-col items-center">
          <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-[28px] bg-white/80 shadow-[0_18px_48px_rgba(99,102,241,0.18)] ring-1 ring-white/70 backdrop-blur-xl">
            <img src={IMAGES.WIZARD_BOY_LOGIN} alt="TRIX" className="h-20 w-20 object-contain" />
          </div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900">连接 TRIX Native</h1>
          <p className="mt-2 max-w-[280px] text-center text-sm leading-6 text-slate-600">
            扫描桌面端生成的二维码，或输入配对码，完成跨局域网持久绑定。
          </p>
        </div>

        <GlassPanel className="mt-8 w-full overflow-hidden !rounded-[28px] border border-white/65 bg-white/65 px-5 py-6 shadow-[0_24px_60px_rgba(79,70,229,0.15)] backdrop-blur-2xl">
          {mode === 'scan' && (
            <>
              <div className="relative mb-6 overflow-hidden rounded-[24px] bg-slate-950/90 p-4 shadow-inner">
                <div id="qr-reader" className="min-h-[300px] w-full overflow-hidden rounded-[20px] bg-black" />
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-2 px-4">
                <p className="text-center text-base font-medium text-slate-800">扫描桌面端展示的配对二维码</p>
                <div className="h-1 w-12 rounded-full bg-slate-300" />
              </div>

              <GlassPanel
                className="ios-pressable ios-surface-button mt-6 !rounded-xl h-12 px-8 flex items-center justify-center cursor-pointer"
                onClick={() => {
                  setMode('input');
                  void stopScanner(true);
                }}
              >
                <Keyboard size={18} className="mr-2 text-slate-700" />
                <span className="text-sm font-bold tracking-wide text-slate-800">手动输入配对码</span>
              </GlassPanel>

              {!isScanning.current && (
                <button
                  type="button"
                  onClick={() => void startScanner()}
                  className="ios-pressable ios-primary-button mt-4 flex items-center gap-2 rounded-full px-6 py-3 font-medium text-white"
                >
                  <Camera size={18} />
                  开启摄像头
                </button>
              )}
            </>
          )}

          {mode === 'input' && (
            <>
              <div className="mb-6 w-full px-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">输入 6~8 位配对码</label>
                <input
                  ref={codeInputRef}
                  type="text"
                  value={codeInput}
                  onChange={(event) => setCodeInput(event.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8))}
                  placeholder="AB12CD34"
                  className="w-full rounded-[1.25rem] border-2 border-purple-200 bg-white/88 px-4 py-3 text-center font-mono text-2xl font-bold tracking-wider text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-all placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  maxLength={8}
                  autoFocus
                  autoCapitalize="characters"
                  spellCheck={false}
                />
              </div>

              <button
                type="button"
                onClick={() => void handlePairWithCode()}
                disabled={!PAIRING_CODE_PATTERN.test(codeInput.trim().toUpperCase()) || loading}
                className="ios-pressable ios-primary-button mb-3 flex w-full items-center justify-center gap-2 rounded-full py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    验证中...
                  </>
                ) : (
                  '验证配对码'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('scan');
                  void startScanner();
                }}
                className="ios-pressable ios-surface-button w-full rounded-full py-3 font-medium text-slate-700"
              >
                返回扫码
              </button>
            </>
          )}

          {mode === 'success' && (
            <div className="flex flex-col items-center py-6">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <Check size={40} className="text-green-600" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-slate-800">配对成功</h3>
              <p className="max-w-[260px] text-center text-slate-600">当前浏览器已绑定到 TRIX Native 通道，刷新后也会自动恢复。</p>
              <button
                type="button"
                onClick={handleUnpair}
                className="ios-pressable mt-6 rounded-full border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600"
              >
                解除绑定
              </button>
            </div>
          )}
        </GlassPanel>

        {lastError && (
          <p className="mt-4 px-4 text-center text-sm text-red-500">{lastError}</p>
        )}
      </div>
    </div>
  );
};

export default Pairing;


