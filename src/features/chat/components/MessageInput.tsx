/**
 * MessageInput component
 * Handles text entry, media preview, speech recognition and send events.
 */

import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Image, Mic, MicOff, Send } from 'lucide-react';
import { useSpeechToText } from '../../../hooks/useSpeechToText';
import { useNotification } from '../../../hooks/useNotification';
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
  placeholder = '输入消息...',
}) => {
  const [pendingMedia, setPendingMedia] = useState<MediaData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showWarning } = useNotification();

  const { isListening, startListening, stopListening } = useSpeechToText({
    lang: 'zh-CN',
    continuous: false,
    interimResults: true,
    onResult: (text) => {
      onChange(value + text);
    },
    onError: (error) => {
      console.error('Speech error:', error);
    },
  });

  const handleSend = () => {
    if ((!value.trim() && !pendingMedia) || disabled) return;

    onSend(value, pendingMedia || undefined);
    onChange('');
    setPendingMedia(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const toggleSpeech = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      showWarning('请选择图片或视频文件');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showWarning('文件大小不能超过 50MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const uri = loadEvent.target?.result as string;
      setPendingMedia({
        uri,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        size: file.size,
      });
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-gradient-to-t from-black/20 to-transparent px-4 pb-4 pt-2">
      <AnimatePresence>
        {pendingMedia && (
          <MediaPreview
            media={pendingMedia}
            onRemove={() => setPendingMedia(null)}
          />
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2">
        {!pendingMedia && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="rounded-full border border-white/20 bg-white/10 p-3 text-white transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            <Image size={20} />
          </motion.button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="relative flex-1">
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-full border border-white/20 bg-white/10 px-4 py-3 pr-12 text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50"
            style={{
              minHeight: '48px',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
          />
        </div>

        {isSpeechSupported && !pendingMedia && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={toggleSpeech}
            disabled={disabled}
            className={`rounded-full border p-3 transition-colors disabled:opacity-50 ${
              isListening
                ? 'animate-pulse border-red-400 bg-red-500/80 text-white'
                : 'border-white/20 bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </motion.button>
        )}

        <motion.button
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={handleSend}
          disabled={disabled || (!value.trim() && !pendingMedia)}
          className="rounded-full bg-indigo-600 p-3 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={20} />
        </motion.button>
      </div>
    </div>
  );
};

export default MessageInput;
