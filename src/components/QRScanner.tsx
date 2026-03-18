import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../utils/errorHandler';
import {
  iosBackdropMotion,
  iosIconButtonMotion,
  iosQuickSpring,
  iosSheetMotion
} from '../utils/iosMotion';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
}

/**
 * 二维码扫描组件
 * 使用 html5-qrcode 库实现相机扫描功能
 */
const QRScanner: React.FC<QRScannerProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  onScanError
}) => {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  // 初始化扫描器
  useEffect(() => {
    if (!isOpen) return;

    const qrCodeRegionId = 'qr-reader';
    
    const startScanner = async () => {
      try {
        // 检查浏览器是否支持 getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('您的浏览器不支持相机访问。请使用 HTTPS 访问或升级浏览器。');
        }

        // 检查相机权限
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // 立即停止，只是检查权限
        setCameraPermission('granted');

        // 初始化扫描器
        scannerRef.current = new Html5Qrcode(qrCodeRegionId);
        
        // 开始扫描
        await scannerRef.current.start(
          { facingMode: 'environment' }, // 后置摄像头
          {
            fps: 10, // 每秒扫描帧数
            qrbox: { width: 250, height: 250 }, // 扫描框大小
            aspectRatio: 1.0, // 宽高比
          },
          (decodedText) => {
            // 扫描成功
            onScanSuccess(decodedText);
            stopScanner();
            onClose();
          },
          () => {
            // 扫描失败（正常情况，没扫到二维码）
            // 不需要处理，继续扫描
          }
        );

        setIsScanning(true);
        setError(null);
      } catch (err: unknown) {
        console.error('[QRScanner] ' + t('qrScanner.startFailed') + ':', err);

        // 类型守卫：检查错误是否具有 name 和 message 属性
        const error = err as { name?: string; message?: string };

        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setCameraPermission('denied');
          setError(t('qrScanner.cameraPermissionDenied'));
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setError(t('qrScanner.noCameraFound'));
        } else if (error.message && error.message.includes('getUserMedia')) {
          setError(t('qrScanner.needHTTPSAccess'));
        } else {
          setError(t('qrScanner.startFailed') + '：' + getErrorMessage(err, t('common.error')));
        }

        onScanError?.(getErrorMessage(err, t('qrScanner.scanFailed')));
      }
    };

    startScanner();

    // 清理函数
    return () => {
      stopScanner();
    };
  }, [isOpen]);

  // 停止扫描器
  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error('[QRScanner] 停止失败:', err);
      }
    }
  };

  // 处理关闭
  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={iosBackdropMotion.initial}
        animate={iosBackdropMotion.animate}
        exit={iosBackdropMotion.exit}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={iosSheetMotion.initial}
          animate={iosSheetMotion.animate}
          exit={iosSheetMotion.exit}
          className="relative mx-4 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/18 shadow-[0_30px_88px_rgba(0,0,0,0.48)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 顶部标题栏 */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-white" />
              <h2 className="text-white font-bold text-lg">{t('qrScanner.title')}</h2>
            </div>
            <motion.button
              onClick={handleClose}
              transition={iosQuickSpring}
              {...iosIconButtonMotion}
              className="ios-pressable ios-secondary-button flex h-10 w-10 items-center justify-center rounded-full text-white"
            >
              <X className="w-5 h-5 text-white" />
            </motion.button>
          </div>

          {/* 扫描区域 */}
          <div className="bg-white rounded-b-2xl overflow-hidden">
            {error ? (
              // 错误提示
              <div className="p-8 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {cameraPermission === 'denied' ? t('qrScanner.needCameraPermission') : error.includes('HTTPS') ? t('qrScanner.needHTTPS') : t('qrScanner.startFailed')}
                </h3>
                <p className="text-sm text-gray-600 mb-6">{error}</p>

                {error.includes('HTTPS') && (
                  <div className="text-xs text-gray-500 bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
                    <p className="font-medium mb-2 text-blue-900">{t('qrScanner.solution')}</p>
                    <ol className="list-decimal list-inside space-y-1 text-left text-blue-800">
                      <li>{t('qrScanner.useLocalhost')}</li>
                      <li>{t('qrScanner.useNgrok')}</li>
                      <li>{t('qrScanner.manualInput')}</li>
                    </ol>
                  </div>
                )}

                {cameraPermission === 'denied' && (
                  <div className="text-xs text-gray-500 bg-gray-100 rounded-lg p-4 mb-4">
                    <p className="font-medium mb-2">{t('qrScanner.howToEnablePermission')}</p>
                    <ol className="list-decimal list-inside space-y-1 text-left">
                      <li>{t('qrScanner.clickLockIcon')}</li>
                      <li>{t('qrScanner.findCameraPermission')}</li>
                      <li>{t('qrScanner.selectAllow')}</li>
                      <li>{t('qrScanner.refreshRetry')}</li>
                    </ol>
                  </div>
                )}
                
                <button
                  onClick={handleClose}
                  className="ios-pressable ios-primary-button rounded-xl px-6 py-2 text-white"
                >
                  {t('qrScanner.close')}
                </button>
              </div>
            ) : (
              // 扫描器容器
              <div className="relative bg-black min-h-[400px]">
                {/* 相机画面容器 - 确保有高度和样式 */}
                <div
                  id="qr-reader"
                  className="w-full min-h-[400px]"
                  style={{
                    border: 'none',
                    borderRadius: '0 0 1rem 1rem',
                  }}
                ></div>

                {/* 扫描提示 */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 text-center">
                  <p className="text-white text-sm font-medium">
                    {t('qrScanner.alignQRCode')}
                  </p>
                  <p className="text-white/70 text-xs mt-1">
                    {t('qrScanner.keepDistance')}
                  </p>
                </div>

                {/* 扫描动画边框 */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-64 h-64">
                    {/* 四个角的装饰 */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-lg"></div>
                    
                    {/* 扫描线动画 */}
                    <motion.div
                      className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent"
                      animate={{ top: ['0%', '100%'] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'linear'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default QRScanner;
