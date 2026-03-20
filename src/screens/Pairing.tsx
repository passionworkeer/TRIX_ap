import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Keyboard, Check, Loader2 } from 'lucide-react';
import { generatePath, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { IMAGES } from '../constants';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { PAIRING_REQUIRED_TOAST_ID } from '../utils/pairingToast';
import { logger } from '../utils/logger';

const PAIRING_CODE_PATTERN = /^[A-Z0-9]{6}$/;

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
      toast.error('无法启动摄像头，请检查相机权限');
    }
  };

  const handlePairSuccess = async () => {
    await stopScanner(true);
      toast.dismiss(PAIRING_REQUIRED_TOAST_ID);
      toast.success('配对成功');
      setMode('success');
      setTimeout(() => {
      navigate(generatePath(AppRoutes.CHAT_DETAIL, { friendId: 'clawbot' }), {
        replace: true,
        state: {
          friendId: 'clawbot',
          name: 'TRIX Bot',
          isBot: true,
        },
      });
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
      toast.error('请输入 6 位字母数字配对码');
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
    toast.success('配对成功');
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
    <div className="min-h-screen bg-gradient-to-br from-[#fdf2ff] via-[#f8fbff] to-[#eef8ff] dark:from-slate-950 dark:via-slate-910 dark:to-slate-950">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-6 pb-28 pt-8 md:pt-16">
        
        {/* Header Section */}
        <div className="relative flex w-full items-center justify-center mb-8">
          <button
            type="button"
            onClick={() => {
              void stopScanner(true);
              navigate(-1);
            }}
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/50 backdrop-blur-md border border-slate-200/50 shadow-sm transition-all active:scale-95 dark:bg-slate-800/50 dark:border-slate-700/50"
            aria-label="返回"
          >
            <ArrowLeft strokeWidth={2.5} size={20} className="text-slate-700 dark:text-slate-300" />
          </button>
          
          <div className="relative flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/80 shadow-[0_8px_24px_rgba(99,102,241,0.12)] ring-1 ring-white/70 backdrop-blur-xl dark:bg-slate-800/80 dark:ring-slate-700/50">
            <img src={IMAGES.WIZARD_BOY_LOGIN} alt="TRIX" className="h-[52px] w-[52px] object-contain" />
          </div>
        </div>

        <div className="flex flex-col items-center mb-6">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-slate-50">配对 TRIX Native</h1>
          <p className="mt-2 text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            扫描屏幕上的二维码<br />或输入配对码完成绑定
          </p>
        </div>

        {/* Main Content Card */}
        <GlassPanel className="w-full flex-1 md:flex-none overflow-hidden !rounded-[32px] border border-white/60 bg-white/70 px-5 py-6 shadow-[0_20px_40px_-15px_rgba(79,70,229,0.1)] backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/70 mb-4">
          
          {mode === 'scan' && (
            <div className="flex h-full flex-col">
              <div className="group relative mb-6 overflow-hidden rounded-[24px] bg-slate-950 shadow-inner ring-1 ring-black/5 dark:ring-white/10">
                <div id="qr-reader" className="min-h-[280px] w-full overflow-hidden bg-black object-cover [&>video]:object-cover" />
                {loading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-md">
                    <Loader2 className="mb-3 h-10 w-10 animate-spin text-white" />
                    <span className="text-sm font-medium text-white/90">验证中...</span>
                  </div>
                )}
                {/* Custom scanning frame overlay */}
                {!loading && isScanning.current && (
                  <div className="pointer-events-none absolute inset-0 z-10 border-[40px] border-black/40">
                    <div className="h-full w-full border-2 border-dashed border-white/30 rounded-lg"></div>
                  </div>
                )}
              </div>

              <div className="mt-auto flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('input');
                    void stopScanner(true);
                  }}
                  className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-5 py-4 font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/50 transition-all hover:bg-slate-50 active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                >
                  <Keyboard size={18} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <span>手动输入配对码</span>
                </button>

                {!isScanning.current && (
                  <button
                    type="button"
                    onClick={() => void startScanner()}
                    className="group relative flex w-full items-center justify-center gap-2.5 rounded-2xl bg-indigo-50 px-5 py-4 font-medium text-indigo-600 transition-all hover:bg-indigo-100 active:scale-[0.98] dark:bg-indigo-500/10 dark:text-indigo-400"
                  >
                    <Camera size={18} />
                    <span>重新启动相机</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === 'input' && (
            <div className="flex h-full flex-col justify-center py-4">
              <div className="mb-8 w-full">
                <label className="mb-4 block text-center text-sm font-medium text-slate-600 dark:text-slate-400">请输入 TRIX Native 上的 6 位配对码</label>
                <div className="relative">
                  <input
                    ref={codeInputRef}
                    type="text"
                    value={codeInput}
                    onChange={(event) => setCodeInput(event.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))}
                    placeholder="AB12CD"
                    className="w-full rounded-[20px] border-2 border-indigo-100 bg-white px-5 py-4 text-center font-mono text-[28px] font-bold tracking-[0.2em] text-slate-800 shadow-sm transition-all focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
                    maxLength={6}
                    autoFocus
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="mt-auto flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void handlePairWithCode()}
                  disabled={!PAIRING_CODE_PATTERN.test(codeInput.trim().toUpperCase()) || loading}
                  className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 font-medium text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-indigo-600/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>验证中...</span>
                    </>
                  ) : (
                    <span className="font-semibold">验证配对</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('scan');
                    void startScanner();
                  }}
                  className="flex w-full items-center justify-center rounded-2xl px-5 py-4 font-medium text-slate-500 transition-colors hover:bg-slate-100/50 hover:text-slate-700 active:scale-[0.98] dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
                >
                  返回扫码
                </button>
              </div>
            </div>
          )}

          {mode === 'success' && (
            <div className="flex h-full flex-col items-center justify-center py-8">
              <div className="relative mb-6">
                <div className="absolute -inset-4 animate-pulse rounded-full bg-green-100 opacity-50 dark:bg-green-500/10" />
                <div className="absolute -inset-2 rounded-full bg-green-100 dark:bg-green-500/20" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30">
                  <Check strokeWidth={3} size={36} />
                </div>
              </div>
              <h3 className="mb-3 text-[22px] font-bold text-slate-800 dark:text-slate-100">配对成功</h3>
              <p className="mb-8 max-w-[240px] text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                当前设备已绑定到 TRIX Native，随时可以进行交互互动
              </p>
              
              <button
                type="button"
                onClick={handleUnpair}
                className="rounded-2xl border border-red-200 bg-white px-6 py-3 font-medium text-red-600 shadow-sm transition-all hover:bg-red-50 active:scale-95 dark:border-red-900/50 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                解除绑定
              </button>
            </div>
          )}
        </GlassPanel>

        {lastError && (
          <div className="w-full max-w-sm rounded-[16px] bg-red-50/80 px-4 py-3 text-center text-sm font-medium text-red-600 backdrop-blur-sm dark:bg-red-500/10 dark:text-red-400">
            {lastError}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pairing;
