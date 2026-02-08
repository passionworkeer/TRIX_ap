import { useState, useEffect, useCallback, useRef } from 'react';

// Web Speech API 类型定义
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new(): SpeechRecognition;
    };
  }
}

/**
 * 语音识别状态
 */
export type SpeechStatus = 
  | 'idle'           // 空闲
  | 'listening'      // 正在监听
  | 'processing'     // 正在处理
  | 'error';         // 错误

/**
 * 语音识别配置
 */
interface UseSpeechToTextOptions {
  lang?: string;              // 语言 (默认: 'zh-CN')
  continuous?: boolean;       // 是否持续监听
  interimResults?: boolean;   // 是否返回临时结果
  maxAlternatives?: number;   // 最大候选数量
  onResult?: (transcript: string) => void;     // 识别结果回调
  onError?: (error: string) => void;           // 错误回调
  onStatusChange?: (status: SpeechStatus) => void;  // 状态变化回调
}

/**
 * 语音转文字 Hook
 * 
 * 使用 Web Speech API 实现语音识别
 */
export function useSpeechToText(options: UseSpeechToTextOptions = {}) {
  const {
    lang = 'zh-CN',
    continuous = false,
    interimResults = true,
    maxAlternatives = 1,
    onResult,
    onError,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string>('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // 检查浏览器支持
  useEffect(() => {
    const SpeechRecognition = 
      window.SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();
    } else {
      setIsSupported(false);
      const errMsg = '当前浏览器不支持语音识别';
      setError(errMsg);
      onError?.(errMsg);
    }
  }, [onError]);

  // 配置语音识别
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = maxAlternatives;

    // 识别结果处理
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      if (interimText) {
        setInterimTranscript(interimText);
      }

      if (finalText) {
        setTranscript(prev => prev + finalText);
        setInterimTranscript('');
        onResult?.(finalText);
      }
    };

    // 开始监听
    recognition.onstart = () => {
      setStatus('listening');
      onStatusChange?.('listening');
      setError('');
    };

    // 结束监听
    recognition.onend = () => {
      setStatus('idle');
      onStatusChange?.('idle');
      setInterimTranscript('');
    };

    // 错误处理
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errMsg = '';
      
      switch (event.error) {
        case 'no-speech':
          errMsg = '未检测到语音';
          break;
        case 'audio-capture':
          errMsg = '无法访问麦克风';
          break;
        case 'not-allowed':
          errMsg = '麦克风权限被拒绝';
          break;
        case 'network':
          errMsg = '网络错误';
          break;
        default:
          errMsg = `语音识别错误: ${event.error}`;
      }

      setError(errMsg);
      setStatus('error');
      onError?.(errMsg);
      onStatusChange?.('error');
    };

  }, [lang, continuous, interimResults, maxAlternatives, onResult, onError, onStatusChange]);

  // 开始监听
  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported) {
      const errMsg = '语音识别不可用';
      setError(errMsg);
      onError?.(errMsg);
      return;
    }

    try {
      setTranscript('');
      setInterimTranscript('');
      recognitionRef.current.start();
    } catch (err) {
      const errMsg = '启动语音识别失败';
      setError(errMsg);
      onError?.(errMsg);
    }
  }, [isSupported, onError]);

  // 停止监听
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error('停止语音识别失败:', err);
    }
  }, []);

  // 重置
  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError('');
    setStatus('idle');
  }, []);

  return {
    isSupported,
    isListening: status === 'listening',
    status,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    reset,
  };
}
