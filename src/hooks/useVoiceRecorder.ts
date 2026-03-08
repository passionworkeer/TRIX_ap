import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 录音 Hook 配置选项
 */
interface UseVoiceRecorderOptions {
  /**
   * 音频 MIME 类型 (默认: audio/webm)
   */
  mimeType?: string;
  /**
   * 音频采样率 (默认: 48000)
   */
  sampleRate?: number;
  /**
   * 最大录音时长（秒，默认 60 秒）
   */
  maxDuration?: number;
  /**
   * 录音开始回调
   */
  onStart?: () => void;
  /**
   * 录音结束回调
   */
  onStop?: (blob: Blob, duration: number) => void;
  /**
   * 错误回调
   */
  onError?: (error: string) => void;
}

/**
 * 录音结果
 */
export interface RecordingResult {
  blob: Blob;        // 录音 Blob 对象
  duration: number;  // 录音时长（秒）
}

/**
 * 语音录音 Hook
 *
 * 使用 MediaRecorder API 实现浏览器录音功能
 *
 * @example
 * ```tsx
 * const {
 *   isRecording,
 *   duration,
 *   startRecording,
 *   stopRecording,
 *   cancelRecording,
 *   error
 * } = useVoiceRecorder({
 *   onStart: () => console.log('开始录音'),
 *   onStop: (blob, duration) => console.log('录音结束', duration),
 *   onError: (error) => console.error('录音错误', error)
 * });
 *
 * // 开始录音
 * await startRecording();
 *
 * // 停止录音
 * const result = await stopRecording();
 * if (result) {
 *   const audioUrl = URL.createObjectURL(result.blob);
 *   // 使用 audioUrl...
 * }
 * ```
 */
export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const {
    mimeType = 'audio/webm',
    sampleRate = 48000,
    onStart,
    onStop,
    onError,
  } = options;

  // 状态
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  // 清理函数
  const cleanup = useCallback(() => {
    // 停止计时器
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 停止媒体流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 重置 MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }

    // 清空录音数据
    chunksRef.current = [];
  }, []);

  // 停止计时器
  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 清理副作用
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  /**
   * 开始录音
   */
  const startRecording = useCallback(async () => {
    // 如果正在录音，先停止
    if (isRecording) {
      cleanup();
    }

    setError(null);
    setDuration(0);
    chunksRef.current = [];

    try {
      // 检查浏览器支持
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errMsg = '当前浏览器不支持录音功能';
        setError(errMsg);
        onError?.(errMsg);
        return;
      }

      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: sampleRate },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // 确定 MIME 类型
      let selectedMimeType = mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // 尝试备用类型
        const fallbackTypes = [
          'audio/webm;codecs=opus',
          'audio/webm;codecs=pcm',
          'audio/mp4',
          'audio/wav',
          'audio/mpeg',
        ];

        for (const type of fallbackTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            selectedMimeType = type;
            break;
          }
        }
      }

      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;

      // 数据可用时收集 chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // 录音停止时处理结果
      mediaRecorder.onstop = () => {
        // 录音时长
        const recordedDuration = Math.floor(
          (Date.now() - startTimeRef.current) / 1000
        );

        // 创建 Blob
        const blob = new Blob(chunksRef.current, { type: selectedMimeType });

        // 回调
        onStop?.(blob, recordedDuration);

        // 清理流
        cleanup();
      };

      // 错误处理
      mediaRecorder.onerror = (event) => {
        let errMsg = '录音发生错误';

        if (event instanceof ErrorEvent) {
          errMsg = `录音错误: ${event.message}`;
        } else if (typeof event === 'object' && 'name' in event) {
          const errorEvent = event as Record<string, unknown>;
          switch (errorEvent.name) {
            case 'AbortError':
              errMsg = '录音被中断';
              break;
            case 'InvalidStateError':
              errMsg = '录音状态无效';
              break;
            default:
              errMsg = `录音错误: ${errorEvent.name}`;
          }
        }

        setError(errMsg);
        onError?.(errMsg);
        cleanup();
      };

      // 开始录音
      mediaRecorder.start(100); // 每 100ms 收集一次数据
      startTimeRef.current = Date.now();
      setIsRecording(true);

      // 获取最大录音时长（默认 60 秒）
      const maxDuration = options.maxDuration ?? 60;

      // 启动计时器
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        // 超过最大时长自动停止
        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 1000);

      onStart?.();
    } catch (err) {
      let errMsg = '无法启动录音';

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errMsg = '麦克风权限被拒绝';
        } else if (err.name === 'NotFoundError') {
          errMsg = '未找到麦克风设备';
        } else if (err.name === 'NotReadableError') {
          errMsg = '麦克风被其他应用占用';
        } else {
          errMsg = `录音错误: ${err.message}`;
        }
      }

      setError(errMsg);
      onError?.(errMsg);
      cleanup();
    }
  }, [isRecording, mimeType, sampleRate, onStart, onStop, onError, cleanup]);

  /**
   * 停止录音
   * @returns 录音结果或 null（如果未在录音）
   */
  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    if (!isRecording || !mediaRecorderRef.current) {
      return null;
    }

    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      // 停止计时器
      stopTimer();

      // 保存最终时长
      const finalDuration = Math.floor(
        (Date.now() - startTimeRef.current) / 1000
      );

      // 监听 stop 事件获取 blob
      const originalOnStop = mediaRecorder.onstop;
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const result: RecordingResult = {
          blob,
          duration: finalDuration,
        };

        // 恢复原始 onstop 处理
        if (originalOnStop) {
          originalOnStop.call(mediaRecorder, new Event('stop'));
        }

        setIsRecording(false);
        resolve(result);
      };

      // 停止录音
      try {
        mediaRecorder.stop();
      } catch (err) {
        setIsRecording(false);
        resolve(null);
      }
    });
  }, [isRecording, mimeType, stopTimer]);

  /**
   * 取消录音
   * 不返回录音结果，直接清理
   */
  const cancelRecording = useCallback(() => {
    if (!isRecording) {
      return;
    }

    // 清理所有资源，不触发 onStop 回调
    cleanup();
    setIsRecording(false);
    setDuration(0);
    chunksRef.current = [];
  }, [isRecording, cleanup]);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    cleanup();
    setIsRecording(false);
    setDuration(0);
    setError(null);
    chunksRef.current = [];
  }, [cleanup]);

  return {
    // 状态
    isRecording,
    duration,
    error,
    // 方法
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  };
}
