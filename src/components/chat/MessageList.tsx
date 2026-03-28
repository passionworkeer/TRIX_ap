import { forwardRef } from 'react';
import botAvatarImg from '../../assets/roles/role1/AvatarHead.png';
import Avatar from '../Avatar';
import MediaMessage from '../MediaMessage';
import FileAttachmentCard from '../FileAttachmentCard';
import VoiceMessage from '../VoiceMessage';

interface UIAttachment {
  id?: string;
  kind: 'image' | 'audio' | 'video' | 'file';
  uri: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

interface UIMessage {
  id: string | number;
  sender: 'user' | 'bot' | 'friend';
  text: string;
  timestamp: string;
  messageType?: 'text' | 'image' | 'video' | 'file' | 'mixed' | 'voice';
  mediaUri?: string;
  mediaType?: string;
  mediaSize?: number;
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    originalName?: string;
    size?: number;
  };
  attachments?: UIAttachment[];
}

interface MessageListProps {
  messages: UIMessage[];
  loading: boolean;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  isBot: boolean;
  isBotConversation: boolean;
  botState: string;
  status: string;
  name: string;
  avatar: string;
  onLoadMore: () => void;
}

const ATTACHMENT_PLACEHOLDERS = ['[image]', '[video]', '[file]', '[media]'];

const getMessageAttachments = (message: UIMessage): UIAttachment[] => {
  if (message.attachments && message.attachments.length > 0) {
    return message.attachments;
  }

  if (!message.mediaUri) {
    return [];
  }

  return [{
    kind: message.messageType === 'voice'
      ? 'audio'
      : message.messageType === 'video'
        ? 'video'
        : message.messageType === 'image'
          ? 'image'
          : 'file',
    uri: message.mediaUri,
    mimeType: message.mediaType,
    fileName: message.mediaMetadata?.originalName,
    size: message.mediaSize ?? message.mediaMetadata?.size,
    width: message.mediaMetadata?.width,
    height: message.mediaMetadata?.height,
    duration: message.mediaMetadata?.duration,
  }];
};

const isVideoAttachment = (attachment: UIAttachment): boolean => {
  const normalizedMimeType = String(attachment.mimeType || '').toLowerCase();
  const normalizedUri = String(attachment.uri || '').toLowerCase();

  return attachment.kind === 'video'
    || normalizedMimeType.startsWith('video/')
    || ['.mp4', '.webm', '.mov', '.m4v', '.avi', '.mpeg'].some((extension) => normalizedUri.endsWith(extension));
};

const isFileAttachment = (attachment: UIAttachment): boolean => {
  const normalizedMimeType = String(attachment.mimeType || '').toLowerCase();
  return attachment.kind === 'file'
    || (!!normalizedMimeType && !normalizedMimeType.startsWith('image/') && !normalizedMimeType.startsWith('video/') && !normalizedMimeType.startsWith('audio/'));
};

const shouldHideAttachmentPlaceholder = (text: string, attachments: UIAttachment[]): boolean => {
  const normalizedText = String(text || '').trim();
  const hasAttachments = attachments.length > 0;

  if (!normalizedText || !hasAttachments) {
    return false;
  }

  if (ATTACHMENT_PLACEHOLDERS.includes(normalizedText)) {
    return true;
  }

  return ATTACHMENT_PLACEHOLDERS.some((placeholder) => normalizedText.startsWith(`${placeholder} `));
};

const MessageList = forwardRef<HTMLDivElement, MessageListProps>(({
  messages,
  loading,
  hasMoreMessages,
  isLoadingMore,
  isBot,
  isBotConversation,
  botState,
  status,
  name,
  avatar,
  onLoadMore,
}, ref) => {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-500 animate-pulse dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          加载聊天记录中...
        </span>
      </div>
    );
  }

  return (
    <>
      {/* 加载更多按钮 */}
      {hasMoreMessages && (
        <div className="py-3 text-center">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-xs text-slate-500 transition hover:bg-slate-200 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            {isLoadingMore ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
                加载中...
              </>
            ) : (
              '加载更多消息'
            )}
          </button>
        </div>
      )}

      <div className="my-4 text-center text-xs text-slate-400 dark:text-slate-500">今天</div>

      {messages.map((msg) => {
        const msgAttachments = getMessageAttachments(msg);
        const visualAttachments = msgAttachments.filter((attachment) => attachment.kind === 'image' || attachment.kind === 'video');
        const fileAttachments = msgAttachments.filter((attachment) => isFileAttachment(attachment));
        const audioAttachments = msgAttachments.filter((attachment) => attachment.kind === 'audio');
        const shouldRenderBubble = audioAttachments.length > 0
          || (msg.text && typeof msg.text === 'string' && msg.text !== '[object Object]' && !shouldHideAttachmentPlaceholder(msg.text, msgAttachments));

        return (
          <div
            key={msg.id}
            className={`group flex animate-in fade-in slide-in-from-bottom-2 duration-300 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender !== 'user' && (
              <div className="mr-2 mt-auto shrink-0">
                {isBot ? (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <img src={botAvatarImg} alt="Bot" className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <Avatar name={name} avatar={avatar} size="xs" />
                )}
              </div>
            )}

            <div className="flex max-w-[75%] flex-col gap-1">
              {visualAttachments.map((attachment) => (
                <div
                  key={attachment.id || attachment.uri}
                  className={`mb-1 overflow-hidden rounded-2xl ${msg.sender === 'user' ? 'rounded-tr-sm flex justify-end' : 'rounded-tl-sm'} bg-slate-100 dark:bg-slate-800`}
                >
                  <MediaMessage
                    uri={attachment.uri}
                    type={isVideoAttachment(attachment) ? 'video' : 'image'}
                    alt="Attachment"
                    maxSize="sm"
                    className="w-full max-w-[240px] h-auto object-cover"
                  />
                </div>
              ))}

              {fileAttachments.map((attachment) => (
                <div
                  key={attachment.id || attachment.uri}
                  className={`mb-1 ${msg.sender === 'user' ? 'flex justify-end' : ''}`}
                >
                  <FileAttachmentCard
                    uri={attachment.uri}
                    mimeType={attachment.mimeType}
                    fileName={attachment.fileName}
                    size={attachment.size}
                    className="max-w-[280px]"
                  />
                </div>
              ))}

              {shouldRenderBubble && (
                <div
                  className={`relative px-4 py-3 text-sm leading-relaxed transition-all duration-200 ${
                    msg.sender === 'user'
                      ? 'rounded-2xl rounded-tr-sm bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm'
                      : 'rounded-2xl rounded-tl-sm bg-slate-100 text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {audioAttachments.map((attachment) => (
                    <div key={attachment.id || attachment.uri} className="-mx-2 -my-1 mb-2 last:mb-0">
                      <VoiceMessage
                        url={attachment.uri}
                        duration={attachment.duration || 0}
                        variant={msg.sender === 'user' ? 'sender' : 'receiver'}
                      />
                    </div>
                  ))}

                  {msg.text && typeof msg.text === 'string' && msg.text !== '[object Object]' && !shouldHideAttachmentPlaceholder(msg.text, msgAttachments) && (
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  )}
                </div>
              )}
              <span
                className={`px-1 text-[10px] text-slate-400 dark:text-slate-500 ${
                  msg.sender === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        );
      })}
      {isBotConversation && botState === 'THINKING' && (
        <div
          className="group flex animate-in fade-in slide-in-from-bottom-2 duration-300 justify-start"
          data-testid="chat-bot-loading-bubble"
          data-bot-state={botState}
        >
          <div className="mr-2 mt-auto shrink-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <img src={botAvatarImg} alt="Bot" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="flex max-w-[75%] flex-col gap-1">
            <div className="relative px-4 py-3 text-sm leading-relaxed shadow-sm transition-all duration-200 rounded-2xl rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce dark:bg-slate-300"
                    style={{ animationDelay: `${index * 120}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isBot && (status === 'CONNECTING' || status === 'RECONNECTING') && (
        <div className="my-4 flex justify-center">
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-500 animate-pulse dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {status === 'RECONNECTING'
              ? '正在重新连接本机 OpenClaw...'
              : '正在连接本机 OpenClaw...'}
          </span>
        </div>
      )}

      <div ref={ref} />
    </>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
