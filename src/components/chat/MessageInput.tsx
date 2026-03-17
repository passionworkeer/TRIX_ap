import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, X } from 'lucide-react';
import AIActionSelector from '../AIActionSelector';
import FileAttachmentCard from '../FileAttachmentCard';
import { iosIconButtonMotion } from '../../utils/iosMotion';
import type { AIActionId } from '../../features/chat/utils/aiPrompt';

interface AttachmentPreview {
  uri: string;
  type: string;
  size?: number;
  category: 'image' | 'video' | 'audio' | 'file';
  uploadId?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    originalName?: string;
    size?: number;
  };
}

interface MessageInputProps {
  input: string;
  isInputFocused: boolean;
  isListening: boolean;
  transcript: string;
  isSpeechSupported: boolean;
  isBotConversation: boolean;
  isPaired: boolean;
  uploadingFile: boolean;
  attachmentPreviews: AttachmentPreview[];
  selectedAIAction: AIActionId;
  onInputChange: (value: string) => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
  onSend: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onToggleVoiceRecorder: () => void;
  onRemoveAttachment: (index: number) => void;
  onAIActionSelect: (action: AIActionId) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploadingVoice?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  input,
  isInputFocused,
  isListening,
  transcript,
  isSpeechSupported,
  isBotConversation,
  isPaired,
  uploadingFile,
  attachmentPreviews,
  selectedAIAction,
  onInputChange,
  onInputFocus,
  onInputBlur,
  onSend,
  onFileSelect,
  onStartListening,
  onStopListening,
  onToggleVoiceRecorder,
  onRemoveAttachment,
  onAIActionSelect,
  fileInputRef,
  isUploadingVoice = false,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-6 pt-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto max-w-lg">
        <AnimatePresence>
          {attachmentPreviews.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-2"
            >
              <div className="flex flex-wrap gap-2">
                {attachmentPreviews.map((preview, index) => (
                  <div key={index} className={`relative ${preview.category === 'file' ? 'w-[240px]' : 'shrink-0'}`}>
                    {preview.category === 'file' ? (
                      <FileAttachmentCard
                        uri={preview.uri}
                        mimeType={preview.type}
                        fileName={preview.metadata?.originalName}
                        size={preview.size ?? preview.metadata?.size}
                        compact
                      />
                    ) : (
                      <div className="h-[80px] w-[80px] overflow-hidden rounded-lg border-2 border-slate-300 shadow-lg dark:border-slate-600">
                        {preview.category === 'video' ? (
                          <video
                            src={preview.uri}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={preview.uri}
                            alt={`附件预览 ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(index)}
                      className="ios-pressable ios-icon-button-compact ios-surface-button absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center text-black dark:text-slate-100"
                      aria-label="删除附件"
                    >
                      <X size={10} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`ios-glass-surface flex flex-col gap-2 rounded-[1.75rem] p-2 transition-all duration-300 ${isInputFocused || input.trim().length > 0 ? "shadow-md" : ""}`}>
          <AnimatePresence>
            {(isInputFocused || input.trim().length > 0 || attachmentPreviews.length > 0) && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden px-1"
              >
                <AIActionSelector
                  value={selectedAIAction}
                  onSelect={(action) => {
                    onAIActionSelect(action);
                    // Note: 无法在这里获取最新 input 值，需要父组件处理
                    onInputFocus();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="*/*"
              onChange={onFileSelect}
              className="hidden"
            />

            <motion.button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              {...iosIconButtonMotion}
              className="ios-pressable ios-icon-button-compact ios-surface-button flex h-8 w-8 shrink-0 items-center justify-center"
              aria-label="添加附件"
            >
              <span className="text-xl text-slate-600 dark:text-slate-200" style={{ lineHeight: '1' }}>+</span>
            </motion.button>

            <textarea
              value={isListening ? transcript : input}
              onChange={(event) => onInputChange(event.target.value)}
              onFocus={onInputFocus}
              onBlur={() => {
                setTimeout(() => onInputBlur(), 200);
              }}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening...' : '输入消息，或使用 AI 指令'}
              rows={isInputFocused || input.trim().length > 0 ? 4 : 1}
              className="flex-1 resize-none rounded-xl border-0 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 transition-all dark:bg-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400"
              style={{
                minHeight: isInputFocused || input.trim().length > 0 ? '96px' : '32px',
                maxHeight: '160px'
              }}
            />

            {isSpeechSupported && isBotConversation && (
              <motion.button
                type="button"
                onClick={() => {
                  if (isListening) onStopListening();
                  else {
                    onStartListening();
                  }
                }}
                {...iosIconButtonMotion}
                className={`ios-pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
                  isListening
                    ? 'border border-slate-300 bg-slate-300 text-slate-700 dark:border-slate-600 dark:bg-slate-600 dark:text-slate-100'
                    : 'ios-surface-button text-slate-600 dark:text-slate-200'
                }`}
                aria-label={isListening ? '停止语音输入' : '开始语音输入'}
              >
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              </motion.button>
            )}

            {/* 语音录制按钮 - 仅在非机器人会话且是好友聊天时显示 */}
            {!isBotConversation && (
              <motion.button
                type="button"
                onClick={onToggleVoiceRecorder}
                disabled={isUploadingVoice}
                {...iosIconButtonMotion}
                className={`ios-pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all ${
                  isUploadingVoice
                    ? 'cursor-not-allowed border border-slate-300 bg-slate-300 text-slate-400 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-500'
                    : 'ios-surface-button text-slate-600 dark:text-slate-200'
                }`}
                aria-label="录制语音消息"
              >
                {isUploadingVoice ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400/30 border-t-slate-400" />
                ) : (
                  <Mic size={14} />
                )}
              </motion.button>
            )}

            <motion.button
              type="button"
              onClick={onSend}
              disabled={
                (!input.trim() && attachmentPreviews.length === 0) ||
                (isBotConversation && !isPaired) ||
                uploadingFile
              }
              {...iosIconButtonMotion}
              className={`ios-pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                input.trim() || attachmentPreviews.length > 0
                  ? 'ios-primary-button text-white'
                  : 'border border-slate-300 bg-slate-300 text-slate-400 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-500'
              }`}
              aria-label="发送消息"
            >
              {uploadingFile ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Send size={14} className={input.trim() ? '-rotate-45 transition-transform' : 'transition-transform'} />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
