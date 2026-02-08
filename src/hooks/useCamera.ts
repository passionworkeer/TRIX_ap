import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 相机状态
 */
export type CameraStatus = 
  | 'idle'        // 空闲
  | 'requesting'  // 请求权限中
  | 'ready'       // 准备就绪
  | 'capturing'   // 拍照中
  | 'error';      // 错误

/**
 * 相机配置
 */
interface UseCameraOptions {
  facingMode?: 'user' | 'environment';  // 前置/后置摄像头
  width?: number;                        // 视频宽度
  height?: number;                       // 视频高度
  onCapture?: (imageUrl: string, blob: Blob) => void;  // 拍照回调
  onError?: (error: string) => void;     // 错误回调
}

/**
 * 拍照结果
 */
export interface CapturedPhoto {
  url: string;       // Data URL
  blob: Blob;        // Blob 对象
  timestamp: number; // 时间戳
}

/**
 * 相机 Hook
 * 
 * 使用 MediaDevices API 实现相机功能
 * 
 * @example
 * ```tsx
 * const { 
 *   videoRef, 
 *   isReady, 
 *   capturedPhoto,
 *   startCamera, 
 *   capture,
 *   stopCamera
 * } = useCamera({
 *   facingMode: 'environment',
 *   onCapture: (url, blob) => console.log('照片已拍摄', url)
 * });
 * 
 * // JSX
 * <video ref={videoRef} autoPlay playsInline />
 * ```
 */
export function useCamera(options: UseCameraOptions = {}) {
  const {
    facingMode = 'environment',
    width = 1920,
    height = 1080,
    onCapture,
    onError,
  } = options;

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string>('');
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 检查浏览器支持
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
      const errMsg = '当前浏览器不支持相机功能';
      setError(errMsg);
      onError?.(errMsg);
    }
  }, [onError]);

  // 启动相机
  const startCamera = useCallback(async () => {
    if (!isSupported) {
      const errMsg = '相机不可用';
      setError(errMsg);
      onError?.(errMsg);
      return;
    }

    setStatus('requesting');
    setError('');

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStatus('ready');
      }
    } catch (err) {
      let errMsg = '启动相机失败';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errMsg = '相机权限被拒绝';
        } else if (err.name === 'NotFoundError') {
          errMsg = '未找到相机设备';
        } else if (err.name === 'NotReadableError') {
          errMsg = '相机被其他应用占用';
        } else {
          errMsg = `相机错误: ${err.message}`;
        }
      }

      setError(errMsg);
      setStatus('error');
      onError?.(errMsg);
    }
  }, [isSupported, facingMode, width, height, onError]);

  // 停止相机
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStatus('idle');
  }, []);

  // 拍照
  const capture = useCallback(() => {
    if (!videoRef.current || status !== 'ready') {
      const errMsg = '相机未就绪';
      setError(errMsg);
      onError?.(errMsg);
      return null;
    }

    setStatus('capturing');

    try {
      // 创建 canvas (如果不存在)
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // 设置 canvas 尺寸为视频实际尺寸
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // 绘制当前帧
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法获取 Canvas 上下文');
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // 转换成 Blob
      canvas.toBlob((blob) => {
        if (!blob) {
          const errMsg = '生成照片失败';
          setError(errMsg);
          setStatus('ready');
          onError?.(errMsg);
          return;
        }

        const url = URL.createObjectURL(blob);
        const photo: CapturedPhoto = {
          url,
          blob,
          timestamp: Date.now(),
        };

        setCapturedPhoto(photo);
        setStatus('ready');
        onCapture?.(url, blob);
      }, 'image/jpeg', 0.9);

      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '拍照失败';
      setError(errMsg);
      setStatus('ready');
      onError?.(errMsg);
      return null;
    }
  }, [status, onCapture, onError]);

  const clearPhoto = useCallback(() => {
    if (capturedPhoto) {
      URL.revokeObjectURL(capturedPhoto.url);
      setCapturedPhoto(null);
    }
  }, [capturedPhoto]);

  return {
    videoRef,
    status,
    isReady: status === 'ready',
    isSupported,
    error,
    capturedPhoto,
    startCamera,
    stopCamera,
    capture,
    clearPhoto,
    switchCamera: startCamera, // 简单实现，重新启动即可
  };
}
