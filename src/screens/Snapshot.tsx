import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FlipHorizontal2, Check, X, Sparkles, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { IMAGES } from '../constants';
import { AppRoutes } from '../types';
import { useClawbotChannel } from '../contexts/ClawbotChannelContext';
import { useCamera } from '../hooks/useCamera';
import { uploadFile } from '../services/uploadService';
import { getErrorMessage } from '../utils/errorHandler';
import {
  PAIRING_REQUIRED_TOAST_MESSAGE,
  PAIRING_REQUIRED_TOAST_OPTIONS
} from '../utils/pairingToast';

type SnapshotActionKey = 'identify' | 'extract_text' | 'study_points' | 'next_steps';

const SNAPSHOT_ACTIONS: Array<{ key: SnapshotActionKey; label: string; prompt: string }> = [
  {
    key: 'identify',
    label: '识别画面内容',
    prompt: '请详细识别这张图片里的主体内容、关键物体和可能场景。',
  },
  {
    key: 'extract_text',
    label: '提取图片文字',
    prompt: '请提取这张图片中的全部可读文字，并按结构整理。',
  },
  {
    key: 'study_points',
    label: '生成学习要点',
    prompt: '请基于图片内容提炼学习要点，给出3-5条重点。',
  },
  {
    key: 'next_steps',
    label: '给出下一步建议',
    prompt: '请结合图片内容，给出可执行的下一步行动建议。',
  },
];

const Snapshot: React.FC = () => {
  const [isResult, setIsResult] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [useMockCamera, setUseMockCamera] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SnapshotActionKey | null>(null);
  const [promptText, setPromptText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fallbackTriggeredRef = useRef(false);
  const navigate = useNavigate();
  const { isConnected, isPaired } = useClawbotChannel();

  const {
    videoRef,
    isReady,
    capturedPhoto,
    startCamera,
    stopCamera,
    capture,
    switchCamera,
    clearPhoto,
    error: cameraError,
    isSupported: isCameraSupported,
  } = useCamera({
    facingMode: 'environment',
    onError: (err) => {
      console.error('Camera error:', err);
      if (!fallbackTriggeredRef.current) {
        fallbackTriggeredRef.current = true;
        setUseMockCamera(true);
      }
    },
  });

  useEffect(() => {
    if (isResult) {
      stopCamera();
      return;
    }

    if (isCameraSupported && !useMockCamera) {
      void startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isResult, isCameraSupported, useMockCamera, startCamera, stopCamera]);

  const handleCapture = () => {
    if (capturedPhoto) return;

    if (useMockCamera || !isReady) {
      toast.error('当前无法获取真实相机画面，请检查权限后重试');
      return;
    }

    setIsScanning(true);
    const result = capture();

    if (!result) {
      setIsScanning(false);
      return;
    }

    window.setTimeout(() => {
      setIsScanning(false);
    }, 450);
  };

  const handleEnterResult = () => {
    if (!capturedPhoto?.blob) {
      toast.error('请先拍摄一张真实照片');
      return;
    }
    setIsResult(true);
  };

  const handleRetake = () => {
    clearPhoto();
    setSelectedAction(null);
    setPromptText('');
    setIsResult(false);

    if (!useMockCamera && isCameraSupported) {
      void startCamera();
    }
  };

  const handleSelectAction = (key: SnapshotActionKey) => {
    const selected = SNAPSHOT_ACTIONS.find(item => item.key === key);
    if (!selected) return;

    setSelectedAction(key);
    setPromptText(selected.prompt);
  };

    const handleSendToClawbot = async () => {
    if (!isConnected || !isPaired) {
      toast.error(PAIRING_REQUIRED_TOAST_MESSAGE, PAIRING_REQUIRED_TOAST_OPTIONS);
      navigate(AppRoutes.PAIRING);
      return;
    }
    if (!capturedPhoto?.blob) {
      toast.error('没有可上传的照片，请重拍');
      return;
    }

    if (!promptText.trim()) {
      toast.error('请先点击一个分析按钮，生成提示词');
      return;
    }

    try {
      setUploading(true);

      const mimeType = capturedPhoto.blob.type || 'image/jpeg';
      const extension = mimeType.includes('png') ? 'png' : 'jpg';
      const file = new File(
        [capturedPhoto.blob],
        `snapshot-${capturedPhoto.timestamp}.${extension}`,
        { type: mimeType }
      );

      const uploadResult = await uploadFile(file, 'image');

      navigate(AppRoutes.CHAT_DETAIL, {
        state: {
          friendId: 'clawbot',
          name: 'TRIX Bot',
          avatar: IMAGES.WIZARD_BOY_LOGIN,
          isBot: true,
          photoUri: uploadResult.uri,
          autoSendPrompt: promptText.trim(),
          source: 'snapshot',
        },
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, '上传失败，请重试'));
    } finally {
      setUploading(false);
    }
  };

  if (isResult) {
    return (
      <div className="relative h-screen w-full flex flex-col overflow-hidden bg-slate-950">
        <div className="flex items-center justify-between px-4 pt-12 pb-4 bg-black/30 backdrop-blur-md border-b border-white/10">
          <button
            onClick={handleRetake}
            className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center"
            aria-label="返回相机"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-white font-semibold text-lg">快照分析</h1>
          <div className="w-10" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <div className="mt-4 rounded-3xl bg-white/5 border border-white/10 p-4 backdrop-blur-md">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
              {capturedPhoto?.url ? (
                <img
                  src={capturedPhoto.url}
                  alt="Snapshot"
                  className="w-full h-56 object-cover"
                />
              ) : (
                <div className="w-full h-56 bg-slate-800 flex items-center justify-center text-slate-400 text-sm">
                  暂无图片
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2 text-cyan-300 text-sm">
              <Sparkles size={14} />
              点击下面按钮会自动生成对应提示词
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {SNAPSHOT_ACTIONS.map(action => (
                <button
                  key={action.key}
                  onClick={() => handleSelectAction(action.key)}
                  className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                    selectedAction === action.key
                      ? 'bg-cyan-500 text-white border-cyan-400'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-300 mb-2">提示词</p>
              <textarea
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                placeholder="点击上方按钮后，这里会出现对应提示词"
                className="w-full min-h-[120px] rounded-xl bg-black/30 border border-white/15 text-white text-sm px-3 py-2 outline-none focus:border-cyan-400"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleRetake}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20"
              >
                重拍
              </button>
              <button
                onClick={handleSendToClawbot}
                disabled={uploading || !promptText.trim()}
                className="flex-1 px-4 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                发送给 Clawbot
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden flex flex-col bg-black">
      {!useMockCamera && isReady ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover z-0"
        />
      ) : (
        <div className="absolute inset-0 z-0">
          <div
            className="w-full h-full bg-cover bg-center opacity-80"
            style={{ backgroundImage: `url(${IMAGES.MUG_SNAPSHOT})` }}
          />
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full justify-between pt-12 pb-24 px-4">
        <header className="mx-2 bg-black/20 backdrop-blur-md rounded-full px-4 py-3 flex items-center justify-between border border-white/20">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-white text-xl font-bold">快照</h1>
            {!useMockCamera && isReady && (
              <div className="flex items-center gap-1 bg-green-500/30 px-2 py-1 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs text-green-100">实时</span>
              </div>
            )}
            {useMockCamera && (
              <div className="flex items-center gap-1 bg-yellow-500/30 px-2 py-1 rounded-full">
                <span className="text-xs text-yellow-100">演示</span>
              </div>
            )}
          </div>

          <button
            onClick={switchCamera}
            disabled={useMockCamera}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white disabled:opacity-50"
          >
            <FlipHorizontal2 size={24} />
          </button>
        </header>

        {cameraError && (
          <div className="mx-4 mt-4 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-2xl px-4 py-3">
            <p className="text-red-100 text-sm text-center">{cameraError}</p>
            <p className="text-red-200 text-xs text-center mt-1">已切换到演示模式</p>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center relative">
          {capturedPhoto && (
            <div className="absolute inset-4 z-20 bg-black/90 backdrop-blur-xl rounded-3xl flex flex-col items-center justify-center p-6 border border-white/20">
              <img
                src={capturedPhoto.url}
                alt="Captured"
                className="max-w-full max-h-[60vh] rounded-2xl shadow-2xl"
              />
              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleRetake}
                  className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center gap-2 transition-colors"
                >
                  <X size={20} />
                  <span>重拍</span>
                </button>
                <button
                  onClick={handleEnterResult}
                  className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full flex items-center gap-2 transition-colors"
                >
                  <Check size={20} />
                  <span>确认分析</span>
                </button>
              </div>
            </div>
          )}

          <div className="relative w-64 h-64 border-2 border-white/0">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

            {isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
                <div className="w-full h-1 bg-cyan-400/80 shadow-[0_0_15px_#22d3ee] animate-scan absolute top-0" />
                <div className="absolute inset-0 bg-cyan-500/10 animate-pulse" />
              </div>
            )}

            {!isScanning && !capturedPhoto && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_white]" />
            )}
          </div>

          <div
            onClick={capturedPhoto ? undefined : handleCapture}
            className={`mt-8 bg-black/40 backdrop-blur-md px-6 py-2 rounded-full flex items-center gap-2 border border-white/20 ${
              capturedPhoto ? '' : 'cursor-pointer hover:bg-black/60'
            } transition-colors`}
          >
            <div className={`w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] ${isScanning ? 'animate-ping' : ''}`} />
            <p className="text-white text-sm font-medium tracking-wider">
              {isScanning ? '拍摄中...' : capturedPhoto ? '照片已就绪' : '点击拍摄以分析'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center w-full mb-8">
          <button
            onClick={capturedPhoto ? undefined : handleCapture}
            disabled={!!capturedPhoto}
            className="relative group cursor-pointer active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 rounded-full bg-cyan-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity" />
            <div className="relative w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/60 flex items-center justify-center">
              {capturedPhoto ? (
                <Check className="w-10 h-10 text-green-400" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-400 to-cyan-200" />
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Snapshot;

