/**
 * MessageInput - 消息输入组件
 *
 * 负责处理用户输入、发送消息、语音输入、媒体文件上传等功能
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Image } from 'lucide-react';
import { useSpeechToText } from '../../../hooks/useSpeechToText';
import MediaPreview from './MediaPreview';

interface MediaData {
  uri: string;
  type: 'image' | 'video';
  size: number;
}

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string, media?: MediaData) => void;
  disabled?: boolean;
  isSpeechSupported?: boolean;
  placeholder?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  isSpeechSupported = false,
  placeholder = '输入消息...'
}) => {
  const [pendingMedia, setPendingMedia] = useState<MediaData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 语音识别
  const {
    isListening,
    startListening,
    stopListening
  } = useSpeechToText({
    lang: 'zh-CN',
    continuous: false,
    interimResults: true,
    onResult: (text) => {
      onChange(value + text);
    },
    onError: (err) => {
      console.error('Speech error:', err);
    }
  });

  // 处理发送
  const handleSend = () => {
    if ((!value.trim() && !pendingMedia) || disabled) return;

    onSend(value, pendingMedia || undefined);

    // 清空输入
    onChange('');
    setPendingMedia(null);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 切换语音识别
  const toggleSpeech = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // 处理文件选择
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 处理文件变更
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('请选择图片或视频文件');
      return;
    }

    // 验证文件大小（50MB 限制）
    if (file.size > 50 * 1024 * 1024) {
      alert('文件大小不能超过 50MB');
      return;
    }

    // 创建预览
    const reader = new FileReader();
    reader.onload = (e) => {
      const uri = e.target?.result as string;
      setPendingMedia({
        uri,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        size: file.size
      });
    };
    reader.readAsDataURL(file);

    // 清空 input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 移除媒体预览
  const handleRemoveMedia = () => {
    setPendingMedia(null);
  };

  return (
    <div className="px-4 pb-4 pt-2 bg-gradient-to-t from-black/20 to-transparent">
      {/* 媒体预览 */}
      <AnimatePresence>
        {pendingMedia && (
          <MediaPreview
            media={pendingMedia}
            onRemove={handleRemoveMedia}
          />
        )}
      </AnimatePresence>

      {/* 输入框 */}
      <div className="flex items-end gap-2">
        {/* 媒体按钮 */}
        {!pendingMedia && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleFileSelect}
            disabled={disabled}
            className="p-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            <Image size={20} />
          </motion.button>
        )}

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 文本输入框 */}
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 pr-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
            style={{
              minHeight: '48px',
              maxHeight: '120px',
              overflowY: 'auto'
            }}
          />
        </div>

        {/* 语音按钮 */}
        {isSpeechSupported && !pendingMedia && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={toggleSpeech}
            disabled={disabled}
            className={`p-3 rounded-full border transition-colors ${
              isListening
                ? 'bg-red-500/80 border-red-400 text-white animate-pulse'
                : 'bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20'
            } disabled:opacity-50`}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </motion.button>
        )}

        {/* 发送按钮 */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={disabled || (!value.trim() && !pendingMedia)}
          className="p-3 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={20} />
        </motion.button>
      </div>
    </div>
  );
};

export default MessageInput;
