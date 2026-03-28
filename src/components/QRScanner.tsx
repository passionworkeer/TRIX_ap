import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../utils/errorHandler';
import {
  iosBackdropMotion,
  iosIconButtonMotion,
  iosQuickSpring,
  iosSheetMotion,
} from '../utils/iosMotion';
import { BrowserQrScanner, toBrowserQrScannerError } from '../utils/browserQrScanner';

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  onScanError,
}) => {
  const { t } = useTranslation();
  const scannerRef = useRef<BrowserQrScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');

  const stopScanner = async () => {
    if (!scannerRef.current) {
      setIsScanning(false);
      return;
    }

    try {
      await scannerRef.current.stop();
    } catch (err) {
      console.error('[QRScanner] stop failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScannerError = (err: unknown) => {
    const normalizedError = toBrowserQrScannerError(err, t('qrScanner.startFailed'));
    setIsScanning(false);

    if (normalizedError.code === 'permission_denied') {
      setCameraPermission('denied');
      setError(t('qrScanner.cameraPermissionDenied'));
    } else if (normalizedError.code === 'no_camera') {
      setError(t('qrScanner.noCameraFound'));
    } else if (normalizedError.code === 'unsupported') {
      setError(normalizedError.message);
    } else {
      setError(`${t('qrScanner.startFailed')}：${getErrorMessage(normalizedError, t('common.error'))}`);
    }

    onScanError?.(getErrorMessage(normalizedError, t('qrScanner.scanFailed')));
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let cancelled = false;

    const startScanner = async () => {
      if (!videoRef.current) {
        return;
      }

      try {
        setError(null);
        setCameraPermission('prompt');

        if (!scannerRef.current) {
          scannerRef.current = new BrowserQrScanner();
        }

        await scannerRef.current.start({
          video: videoRef.current,
          onDetected: (decodedText) => {
            if (cancelled) {
              return;
            }
            void stopScanner();
            onScanSuccess(decodedText);
            onClose();
          },
          onError: (scanError) => {
            if (cancelled) {
              return;
            }
            handleScannerError(scanError);
          },
        });

        if (cancelled) {
          await stopScanner();
          return;
        }

        setCameraPermission('granted');
        setIsScanning(true);
      } catch (err) {
        if (cancelled) {
          return;
        }
        handleScannerError(err);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [isOpen, onClose, onScanSuccess, onScanError, t]);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={iosBackdropMotion.initial}
        animate={iosBackdropMotion.animate}
        exit={iosBackdropMotion.exit}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={() => {
          void handleClose();
        }}
      >
        <motion.div
          initial={iosSheetMotion.initial}
          animate={iosSheetMotion.animate}
          exit={iosSheetMotion.exit}
          className="relative mx-4 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/18 shadow-[0_30px_88px_rgba(0,0,0,0.48)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-white" />
              <h2 className="text-lg font-bold text-white">{t('qrScanner.title')}</h2>
            </div>
            <motion.button
              onClick={() => {
                void handleClose();
              }}
              transition={iosQuickSpring}
              {...iosIconButtonMotion}
              className="ios-pressable ios-secondary-button flex h-10 w-10 items-center justify-center rounded-full text-white"
            >
              <X className="h-5 w-5 text-white" />
            </motion.button>
          </div>

          <div className="overflow-hidden rounded-b-2xl bg-white">
            {error ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <AlertCircle className="mb-4 h-16 w-16 text-red-500" />
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  {cameraPermission === 'denied' ? t('qrScanner.needCameraPermission') : t('qrScanner.startFailed')}
                </h3>
                <p className="mb-6 text-sm text-gray-600">{error}</p>

                {cameraPermission === 'denied' && (
                  <div className="mb-4 rounded-lg bg-gray-100 p-4 text-left text-xs text-gray-500">
                    <p className="mb-2 font-medium">{t('qrScanner.howToEnablePermission')}</p>
                    <ol className="list-inside list-decimal space-y-1">
                      <li>{t('qrScanner.clickLockIcon')}</li>
                      <li>{t('qrScanner.findCameraPermission')}</li>
                      <li>{t('qrScanner.selectAllow')}</li>
                      <li>{t('qrScanner.refreshRetry')}</li>
                    </ol>
                  </div>
                )}

                <button
                  onClick={() => {
                    void handleClose();
                  }}
                  className="ios-pressable ios-primary-button rounded-xl px-6 py-2 text-white"
                >
                  {t('qrScanner.close')}
                </button>
              </div>
            ) : (
              <div className="relative min-h-[400px] bg-black">
                <div id="qr-reader" className="min-h-[400px] w-full overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    className="min-h-[400px] w-full object-cover"
                    autoPlay
                    muted
                    playsInline
                  />
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 text-center">
                  <p className="text-sm font-medium text-white">{t('qrScanner.alignQRCode')}</p>
                  <p className="mt-1 text-xs text-white/70">
                    {isScanning ? t('qrScanner.keepDistance') : t('qrScanner.startFailed')}
                  </p>
                </div>

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-64 w-64">
                    <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-indigo-500" />
                    <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-indigo-500" />
                    <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-indigo-500" />
                    <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-indigo-500" />

                    {isScanning && (
                      <motion.div
                        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent"
                        animate={{ top: ['0%', '100%'] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      />
                    )}
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
