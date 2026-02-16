/**
 * MessageList - 消息列表组件
 *
 * 显示聊天消息列表，支持文本、图片、视频等多种消息类型
 */

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot } from 'lucide-react';
import Avatar from '../../../components/Avatar';
import MediaMessage from '../../../components/MediaMessage';

export interface Message {
  id: string | number;
  sender: 'user' | 'bot' | 'friend';
  text: string;
  timestamp: string;
  messageType?: 'text' | 'image' | 'video' | 'mixed';
  mediaUri?: string;
  mediaType?: string;
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
}

interface MessageListProps {
  messages: Message[];
  isBot?: boolean;
  isLoading?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isBot = false,
  isLoading = false
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-2"></div>
          <p className="text-sm">加载聊天记录中...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          {isBot ? (
            <Bot size={48} className="mx-auto mb-2 opacity-50" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-300 mx-auto mb-2"></div>
          )}
          <p className="text-sm">开始聊天吧</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <AnimatePresence initial={false}>
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          const showAvatar = index === 0 || messages[index - 1]?.sender !== msg.sender;

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                {/* 头像 */}
                {!isUser && showAvatar && (
                  <Avatar
                    name={isBot ? 'Bot' : 'Friend'}
                    avatar={isBot ? undefined : undefined}
                    size="sm"
                    className="w-8 h-8 rounded-full border border-white/10 flex-shrink-0"
                  />
                )}

                {/* 消息内容 */}
                <div
                  className={`px-4 py-2 rounded-2xl ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-white/10 backdrop-blur-sm text-white rounded-bl-sm'
                  }`}
                >
                  {/* 文本消息 */}
                  {msg.text && (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                  )}

                  {/* 媒体消息 */}
                  {(msg.messageType === 'image' || msg.messageType === 'video') && msg.mediaUri && (
                    <MediaMessage
                      uri={msg.mediaUri}
                      type={msg.messageType}
                    />
                  )}

                  {/* 时间戳 */}
                  <p
                    className={`text-xs mt-1 ${
                      isUser ? 'text-white/80' : 'text-gray-500'
                    }`}
                  >
                    {msg.timestamp}
                  </p>
                </div>

                {/* 用户头像占位 */}
                {isUser && showAvatar && (
                  <div className="w-8 h-8 flex-shrink-0"></div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* 滚动锚点 */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
