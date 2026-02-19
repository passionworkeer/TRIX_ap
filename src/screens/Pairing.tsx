import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Keyboard, Check, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import toast, { Toaster } from 'react-hot-toast';
import { IMAGES } from '../constants';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';

const Pairing: React.FC = () => {
  const navigate = useNavigate();
  const {
    isConnected,
    isPaired,
    pairWithCode,
    pairWithQR,
    unpair,
    lastError,
  } = useClawbotChannel();

  const [mode, setMode] = useState<'scan' | 'input' | 'waiting' | 'success'>('scan');
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanning = useRef(false);

  const stopScanner = async () => {
    if (scannerRef.current && isScanning.current) {
      try {
        await scannerRef.current.stop();
        isScanning.current = false;
      } catch (error) {
        console.error('Stop scanner failed:', error);
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
          // Ignore normal scanning parse errors.
        }
      );

      isScanning.current = true;
      toast.success('摄像头已启动');
    } catch (error) {
      console.error('Start scanner failed:', error);
      toast.error('无法访问摄像头，请检查权限设置');
    }
  };

  const handleScanSuccess = async (decodedText: string) => {
    await stopScanner();
    setLoading(true);

    const normalized = decodedText.trim();
    let qrToken: string | null = null;

    try {
      const parsed = JSON.parse(normalized);
      const maybeToken = parsed?.token || parsed?.pairingToken;
      if (typeof maybeToken === 'string' && maybeToken.trim()) {
        qrToken = maybeToken.trim();
      }
    } catch {
      // Not JSON; fallback to pairing-code path.
    }

    try {
      if (qrToken) {
        const success = await pairWithQR(qrToken);
        if (success) {
          setMode('waiting');
          return;
        }

        toast.error('二维码配对失败');
        return;
      }

      if (normalized.length === 6 && /^[A-Z0-9]+$/i.test(normalized)) {
        const success = await pairWithCode(normalized.toUpperCase());
        if (success) {
          setMode('waiting');
          return;
        }

        toast.error('配对码无效或已过期');
        return;
      }

      toast.error('无效的二维码或配对码');
    } catch (error: any) {
      toast.error(error?.message || '配对失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePairWithCode = async () => {
    if (!codeInput || codeInput.length !== 6) {
      toast.error('请输入 6 位配对码');
      return;
    }

    try {
      setLoading(true);
      const success = await pairWithCode(codeInput.toUpperCase());
      if (success) {
        setMode('waiting');
        toast.success('配对码已提交，等待设备确认');
      } else {
        toast.error('配对码无效或已过期');
      }
    } catch (error: any) {
      toast.error(error?.message || '配对失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUnpair = () => {
    void stopScanner();
    unpair();
    setMode('scan');
    setCodeInput('');
    toast.success('已取消配对');
  };

  useEffect(() => {
    if (isPaired) {
      setMode('success');
      void stopScanner();
      toast.success('配对成功');

      const timer = window.setTimeout(() => {
        navigate(AppRoutes.CHAT_DETAIL, {
          state: {
            friendId: 'clawbot',
            name: 'TRIX Bot',
            avatar: IMAGES.WIZARD_BOY_LOGIN,
            isBot: true,
          },
        });
      }, 1500);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [isPaired, navigate]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  return (
    <div className="relative h-screen w-full flex flex-col bg-gradient-to-br from-cyan-100 via-indigo-100 to-pink-100 overflow-hidden">
      <Toaster position="top-center" />

      <header className="flex items-center p-4 pt-12 pb-2 justify-between z-20">
        <button
          onClick={() => navigate(AppRoutes.PROFILE)}
          className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full bg-white/30 hover:bg-white/40 transition-colors backdrop-blur-sm text-slate-800 border border-white/20"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-slate-800 text-lg font-bold flex-1 text-center pr-10">设备配对</h2>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative w-full px-6 pb-24 z-10">
        {!isConnected && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2 bg-orange-500/20 backdrop-blur-sm rounded-full border border-orange-500/30">
            <AlertCircle size={16} className="text-orange-600" />
            <span className="text-orange-700 text-sm font-medium">正在连接服务器...</span>
          </div>
        )}

        {mode === 'scan' && (
          <>
            <div className="relative w-full max-w-[300px] md:max-w-sm aspect-square rounded-[2rem] bg-white/10 backdrop-blur-xl border border-white/30 shadow-[0_8px_32px_rgba(127,19,236,0.15)] overflow-hidden mb-6">
              <div id="qr-reader" className="w-full h-full"></div>

              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-0 w-full h-[2px] bg-purple-600 shadow-[0_0_10px_#9333ea] animate-scan"></div>
              </div>

              <div className="absolute top-6 left-6 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl opacity-80 pointer-events-none"></div>
              <div className="absolute top-6 right-6 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl opacity-80 pointer-events-none"></div>
              <div className="absolute bottom-6 left-6 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl opacity-80 pointer-events-none"></div>
              <div className="absolute bottom-6 right-6 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl opacity-80 pointer-events-none"></div>
            </div>

            <div className="flex flex-col items-center gap-2 mb-6 px-4">
              <p className="text-slate-800 text-base font-medium text-center max-w-[280px] md:max-w-md">
                扫描电脑端展示的配对二维码
              </p>
              <div className="w-12 h-1 bg-white/40 rounded-full"></div>
            </div>

            <GlassPanel
              className="!rounded-xl h-12 px-8 flex items-center justify-center cursor-pointer hover:bg-white/60 transition-colors"
              onClick={() => {
                setMode('input');
                void stopScanner();
              }}
            >
              <Keyboard size={18} className="mr-2 text-slate-700" />
              <span className="text-slate-800 text-sm font-bold tracking-wide">或输入配对码</span>
            </GlassPanel>

            {!isScanning.current && (
              <button
                onClick={() => void startScanner()}
                className="mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-medium transition-colors flex items-center gap-2"
                aria-label="启动摄像头扫描"
              >
                <Camera size={18} />
                启动摄像头
              </button>
            )}
          </>
        )}

        {mode === 'input' && (
          <>
            <div className="w-full max-w-[300px] md:max-w-sm mb-6 px-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                输入 6 位配对码
              </label>
              <input
                type="text"
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-wider bg-white/90 border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                maxLength={6}
                autoFocus
              />
            </div>

            <button
              onClick={() => void handlePairWithCode()}
              disabled={codeInput.length !== 6 || loading}
              className="w-full max-w-[300px] py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-full font-medium transition-colors flex items-center justify-center gap-2 mb-3"
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
              onClick={handleUnpair}
              className="w-full max-w-[300px] py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full font-medium transition-colors"
            >
              取消配对
            </button>

            <button
              onClick={() => {
                setMode('scan');
                void startScanner();
              }}
              className="mt-4 text-slate-600 text-sm flex items-center gap-1 hover:text-slate-800 transition-colors"
            >
              <Camera size={16} />
              返回扫码
            </button>
          </>
        )}

        {mode === 'waiting' && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 mb-6 rounded-full bg-purple-100 flex items-center justify-center">
              <Loader2 size={40} className="text-purple-600 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">等待设备确认</h3>
            <p className="text-slate-600 text-center max-w-[280px]">请在电脑端确认配对请求</p>
          </div>
        )}

        {mode === 'success' && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 mb-6 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={40} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">配对成功</h3>
            <p className="text-slate-600 text-center max-w-[280px] mb-6">您的设备已连接到 Clawbot</p>
            <button
              onClick={() => navigate(AppRoutes.CHAT_DETAIL, {
                state: {
                  friendId: 'clawbot',
                  name: 'TRIX Bot',
                  avatar: IMAGES.WIZARD_BOY_LOGIN,
                  isBot: true,
                },
              })}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-medium transition-colors"
            >
              开始聊天
            </button>
          </div>
        )}

        {lastError && (
          <div className="fixed top-20 left-4 right-4 max-w-md mx-auto bg-red-500/90 backdrop-blur-sm text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
            <AlertCircle size={18} />
            <span className="text-sm">{lastError}</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default Pairing;
