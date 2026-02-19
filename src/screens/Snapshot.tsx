import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, FlipHorizontal2, MoreHorizontal, ShoppingCart, Edit3, Check, Sparkles, Home, History, User, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IMAGES } from '../constants';
import GlassPanel from '../components/GlassPanel';
import { AppRoutes } from '../types';
import { useCamera } from '../hooks/useCamera';

const Snapshot: React.FC = () => {
  const [isResult, setIsResult] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [useMockCamera, setUseMockCamera] = useState(false);
  const fallbackTriggeredRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  // 1. 真实相机功能
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
    onCapture: (url, blob) => {
      console.log(' 照片已拍摄', url);
      console.log(' Blob 大小:', blob.size, 'bytes');
    },
    onError: (err) => {
      console.error(' 相机错误:', err);
      if (!fallbackTriggeredRef.current) {
        fallbackTriggeredRef.current = true;
        setUseMockCamera(true); // 相机失败时回退到模拟模式
      }
    }
  });

  useEffect(() => {
    if (location.pathname.includes('/result')) {
      setIsResult(true);
      setIsScanning(false);
      stopCamera(); // 结果页面停止相机
    } else {
      setIsResult(false);
      // 尝试启动真实相机
      if (isCameraSupported && !useMockCamera) {
        startCamera();
      }
    }

    return () => {
      stopCamera(); // 组件卸载时停止相机
    };
  }, [location.pathname, isCameraSupported]);

  const handleScan = () => {
    if (!useMockCamera && isReady) {
      // 使用真实相机拍照
      const photoUrl = capture();
      if (photoUrl) {
        setIsScanning(true);
        setTimeout(() => {
          setIsScanning(false);
          navigate(AppRoutes.SNAPSHOT_RESULT);
        }, 2000);
      }
    } else {
      // 模拟拍照
      setIsScanning(true);
      setTimeout(() => {
        setIsScanning(false);
        navigate(AppRoutes.SNAPSHOT_RESULT);
      }, 2000);
    }
  };

  if (isResult) {
    return (
      <div className="relative h-screen w-full flex flex-col overflow-hidden bg-gray-900">
        <div className="absolute inset-0 z-0">
          <div className="h-full w-full bg-cover bg-center scale-105 blur-sm brightness-50" style={{ backgroundImage: `url(${IMAGES.MUG_SNAPSHOT})` }}></div>
        </div>
        
        <div className="relative z-10 flex h-full flex-col justify-end">
          <div className="bg-white/75 dark:bg-slate-900/85 backdrop-blur-xl w-full rounded-t-[2.5rem] shadow-2xl relative animate-[float_0.5s_ease-out] pb-32 pt-4 px-6 border-t border-white/20">
            <div className="flex justify-center mb-6">
              <div className="h-1.5 w-12 rounded-full bg-gray-300/80"></div>
            </div>
            
            <div className="flex flex-col items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-[0_4px_12px_rgba(22,163,74,0.4)] flex items-center justify-center text-white">
                <Check strokeWidth={4} size={24} />
              </div>
              <h2 className="text-slate-900 dark:text-white text-3xl font-bold tracking-tight">分析完成</h2>
            </div>

            <GlassPanel className="mb-6 p-3 flex items-center gap-4 !bg-white/50 dark:!bg-white/10 !border-white/40 !rounded-2xl">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-200">
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${IMAGES.MUG_THUMB})` }}></div>
              </div>
              <div className="flex flex-col justify-center flex-1">
                <p className="text-slate-900 dark:text-white text-lg font-bold">复古陶瓷马克杯</p>
                <div className="flex items-center gap-1 mt-1 text-purple-600 dark:text-purple-400">
                  <Sparkles size={14} fill="currentColor" />
                  <p className="text-sm font-medium">Confidence 98%</p>
                </div>
              </div>
              <button className="w-11 h-11 p-2.5 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 active:scale-95 transition-all"
                      aria-label="更多选项">
                 <MoreHorizontal size={18} className="text-slate-500" />
              </button>
            </GlassPanel>

            <div className="grid gap-4">
              <button className="group flex w-full items-center justify-center gap-3 rounded-full bg-white dark:bg-slate-800 py-4 shadow-lg border border-purple-500/20 active:scale-95 transition-all">
                <ShoppingCart className="text-purple-600" />
                <span className="text-slate-900 dark:text-white font-bold">在亚马逊搜索</span>
              </button>
              <button className="flex w-full items-center justify-center gap-3 rounded-full bg-white/40 border border-white/50 py-4 font-medium active:scale-95 transition-all">
                <Edit3 className="text-slate-600 dark:text-slate-300" />
                <span className="text-slate-900 dark:text-white">保存到 Notion</span>
              </button>
            </div>
          </div>
          
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
             <div className="bg-white/40 backdrop-blur-md border border-white/50 rounded-full px-6 py-4 flex items-center gap-8 shadow-xl">
                <button onClick={() => navigate(AppRoutes.HOME)}><Home size={24} className="text-slate-500" /></button>
                <button onClick={() => setIsResult(false)} className="relative">
                  <div className="absolute -top-2 -right-1 w-2 h-2 bg-purple-500 rounded-full"></div>
                  <div className="text-purple-600"><Check size={28} /></div>
                </button>
                <button><History size={24} className="text-slate-500" /></button>
                <button><User size={24} className="text-slate-500" /></button>
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
           <div className="w-full h-full bg-cover bg-center opacity-80" style={{ backgroundImage: `url(${IMAGES.MUG_SNAPSHOT})` }}></div>
         </div>
       )}

       <div className="relative z-10 flex flex-col h-full justify-between pt-12 pb-24 px-4">
          <header className="mx-2 bg-black/20 backdrop-blur-md rounded-full px-4 py-3 flex items-center justify-between border border-white/20">
             <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white">
               <ArrowLeft size={24} />
             </button>
             <div className="flex items-center gap-2">
               <h1 className="text-white text-xl font-bold">快照</h1>
               {!useMockCamera && isReady && (
                 <div className="flex items-center gap-1 bg-green-500/30 px-2 py-1 rounded-full">
                   <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
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
              <p className="text-red-100 text-sm text-center"> {cameraError}</p>
              <p className="text-red-200 text-xs text-center mt-1">已切换到演示模式</p>
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center relative">
             {capturedPhoto && !isResult && (
               <div className="absolute inset-4 z-20 bg-black/90 backdrop-blur-xl rounded-3xl flex flex-col items-center justify-center p-6 border border-white/20">
                 <img 
                   src={capturedPhoto.url} 
                   alt="Captured" 
                   className="max-w-full max-h-[60vh] rounded-2xl shadow-2xl"
                 />
                 <div className="flex gap-4 mt-6">
                   <button
                     onClick={() => {
                       clearPhoto();
                       if (!useMockCamera) startCamera();
                     }}
                     className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center gap-2 transition-colors"
                   >
                     <X size={20} />
                     <span>重拍</span>
                   </button>
                   <button
                     onClick={handleScan}
                     className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full flex items-center gap-2 transition-colors"
                   >
                     <Check size={20} />
                     <span>确认分析</span>
                   </button>
                 </div>
               </div>
             )}

             <div className="relative w-64 h-64 border-2 border-white/0">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                
                {isScanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden">
                         <div className="w-full h-1 bg-cyan-400/80 shadow-[0_0_15px_#22d3ee] animate-scan absolute top-0"></div>
                         <div className="absolute inset-0 bg-cyan-500/10 animate-pulse"></div>
                    </div>
                )}

                {!isScanning && !capturedPhoto && (
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_white]"></div>
                )}
             </div>

             <div 
               onClick={capturedPhoto ? undefined : handleScan} 
               className={`mt-8 bg-black/40 backdrop-blur-md px-6 py-2 rounded-full flex items-center gap-2 border border-white/20 ${
                 capturedPhoto ? '' : 'cursor-pointer hover:bg-black/60'
               } transition-colors`}
             >
                <div className={`w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] ${isScanning ? 'animate-ping' : ''}`}></div>
                <p className="text-white text-sm font-medium tracking-wider">
                  {isScanning ? '扫描中...' : capturedPhoto ? '照片已就绪' : '点击拍摄以分析'}
                </p>
             </div>
          </div>

          <div className="flex flex-col items-center w-full mb-8">
             <button 
               onClick={capturedPhoto ? undefined : handleScan} 
               disabled={!!capturedPhoto}
               className="relative group cursor-pointer active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
             >
                <div className="absolute inset-0 rounded-full bg-cyan-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
                <div className="relative w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border-4 border-white/60 flex items-center justify-center">
                   {capturedPhoto ? (
                     <Check className="w-10 h-10 text-green-400" />
                   ) : (
                     <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-400 to-cyan-200"></div>
                   )}
                </div>
             </button>
          </div>
       </div>
    </div>
  );
};

export default Snapshot;
