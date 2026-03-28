import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Image, Loader2, Mic, Paperclip, RefreshCw, Search, Send, Smile, User } from 'lucide-react';

type AttachmentType = 'image' | 'audio' | 'video' | 'file';

type Attachment = {
  type: AttachmentType;
  url: string;
  name: string;
  mimeType?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
};

type ChatSession = {
  id: string;
  title: string;
  preview: string;
  updatedAt: Date;
  messages: ChatMessage[];
};

type TrixConversation = { id: string; title: string; preview?: string; updatedAt?: string };
type TrixMessage = { id: string; content: string; direction: 'incoming' | 'outgoing'; timestamp: string; attachments?: Attachment[] };

const C = {
  primary: '#630ed4',
  primary2: '#7c3aed',
  white: '#ffffff',
  bg: '#ffffff',
  panel: '#f2f4f6',
  panel2: '#e6e8ea',
  text: '#191c1e',
  muted: '#4a4455',
  border: '#ccc3d8',
};

const EMOJIS = ['🙂', '👏', '🔥', '💡', '🚀', '🎯', '✅', '⭐', '🎉', '👍'];
const AUDIO_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'] as const;
const AUDIO_EXT: Record<string, string> = { 'audio/webm;codecs=opus': 'webm', 'audio/webm': 'webm', 'audio/ogg;codecs=opus': 'ogg', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/wav': 'wav', 'audio/mpeg': 'mp3' };
const LABELS: Record<AttachmentType, string> = { image: '图片', audio: '语音', video: '视频', file: '文件' };

function inferType(mimeType: string | undefined, fileName: string): AttachmentType {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (ext && ['mp3', 'wav', 'ogg', 'm4a', 'opus', 'aac'].includes(ext)) return 'audio';
  if (ext && ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  return 'file';
}

function previewOf(message: Pick<ChatMessage, 'content' | 'attachments'>): string {
  const text = message.content.trim();
  if (text) return text;
  const attachment = message.attachments?.[0];
  return attachment ? `[${LABELS[attachment.type]}] ${attachment.name}` : '';
}

function asMessages(result: { success: boolean; data?: TrixMessage[] }): ChatMessage[] {
  if (!result.success || !Array.isArray(result.data)) return [];
  return result.data.map((message) => ({
    id: message.id,
    role: message.direction === 'outgoing' ? 'user' : 'assistant',
    content: message.content,
    timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
    attachments: message.attachments,
  }));
}

function asSessions(result: { success: boolean; data?: TrixConversation[] }): ChatSession[] {
  if (!result.success || !Array.isArray(result.data)) return [];
  return result.data.map((conversation) => ({
    id: conversation.id,
    title: conversation.title || 'TRIX Native',
    preview: conversation.preview || '',
    updatedAt: conversation.updatedAt ? new Date(conversation.updatedAt) : new Date(),
    messages: [],
  }));
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const attachments = message.attachments ?? [];
  return (
    <div style={{ display: 'flex', gap: 12, maxWidth: '76%', marginLeft: isUser ? 'auto' : 0, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: isUser ? C.panel2 : 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isUser ? <User size={14} color={C.muted} /> : <Bot size={14} color={C.primary} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: '14px 16px', borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: isUser ? `linear-gradient(135deg, ${C.primary}, ${C.primary2})` : C.panel, color: isUser ? C.white : C.text }}>
        {attachments.map((attachment) => (
          <div key={`${message.id}-${attachment.url}`} style={{ marginBottom: message.content ? 10 : 0, padding: attachment.type === 'image' ? 0 : 10, borderRadius: 10, overflow: 'hidden', background: attachment.type === 'image' ? 'transparent' : (isUser ? 'rgba(255,255,255,0.15)' : C.bg), border: attachment.type === 'image' ? 'none' : `1px solid ${isUser ? 'rgba(255,255,255,0.15)' : C.border}` }}>
            {attachment.type === 'image' && <img src={attachment.url} alt={attachment.name} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />}
            {attachment.type === 'audio' && <audio controls preload="none" src={attachment.url} style={{ width: '100%' }} />}
            {attachment.type === 'video' && <video controls preload="metadata" src={attachment.url} style={{ width: '100%', maxHeight: 220, display: 'block' }} />}
            {attachment.type !== 'image' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: attachment.type === 'file' ? 0 : 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{LABELS[attachment.type]}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{attachment.name}</div>
                </div>
                <a href={attachment.url} target="_blank" rel="noreferrer" download={attachment.name} style={{ color: isUser ? C.white : C.primary, fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>打开</a>
              </div>
            )}
          </div>
        ))}
        {message.content && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</p>}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const api = window.electronAPI;
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const composerDisabled = !api || !activeSessionId;
  const interactionDisabled = composerDisabled || isSending;
  const canRecord = typeof navigator !== 'undefined' && typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  const clearComposer = useCallback(() => {
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, []);

  const loadConversations = useCallback(async () => {
    if (!api) {
      setSessions([]);
      setActiveSessionId('');
      return;
    }
    try {
      const parsed = asSessions(await api.listConversations() as { success: boolean; data?: TrixConversation[] });
      setSessions(parsed);
      setActiveSessionId((current) => parsed.find((entry) => entry.id === current)?.id ?? parsed[0]?.id ?? '');
    } catch {
      setSessions([]);
      setActiveSessionId('');
    }
  }, [api]);

  const loadMessages = useCallback(async (conversationId: string) => {
    if (!api || !conversationId) return;
    try {
      const messages = asMessages(await api.fetchMessages(conversationId) as { success: boolean; data?: TrixMessage[] });
      setSessions((current) => current.map((session) => session.id === conversationId ? { ...session, messages, preview: messages.length ? previewOf(messages[messages.length - 1]!) : '' } : session));
    } catch {}
  }, [api]);

  const appendMessage = useCallback((conversationId: string, message: ChatMessage) => {
    setSessions((current) => current.map((session) => session.id === conversationId ? { ...session, messages: [...session.messages, message], preview: previewOf(message) || session.preview, updatedAt: message.timestamp } : session));
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!activeSession?.id) return undefined;
    void loadMessages(activeSession.id);
    const id = window.setInterval(() => { void loadMessages(activeSession.id); }, 4000);
    return () => window.clearInterval(id);
  }, [activeSession?.id, loadMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeSession?.messages.length, isSending]);
  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const sendAttachment = useCallback(async (payload: { fileName: string; mimeType: string; contentBase64: string; kind: AttachmentType; text?: string }) => {
    if (!api || !activeSessionId) return;
    setIsSending(true);
    try {
      const result = await api.sendAttachmentMessage(activeSessionId, payload) as { success: boolean; data?: TrixMessage };
      if (result.success && result.data) {
        const message = asMessages({ success: true, data: [result.data] })[0];
        if (message) appendMessage(activeSessionId, message);
        if (payload.text?.trim()) clearComposer();
      } else {
        await loadMessages(activeSessionId);
      }
    } catch {
      await loadMessages(activeSessionId);
    } finally {
      setIsSending(false);
    }
  }, [activeSessionId, api, appendMessage, clearComposer, loadMessages]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || !api || !activeSessionId) return;
    setIsSending(true);
    try {
      const result = await api.sendMessage(activeSessionId, text) as { success: boolean; data?: TrixMessage };
      if (result.success && result.data) {
        const message = asMessages({ success: true, data: [result.data] })[0];
        if (message) appendMessage(activeSessionId, message);
        clearComposer();
      } else {
        await loadMessages(activeSessionId);
      }
    } catch {
      await loadMessages(activeSessionId);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const mimeType = file.type || 'application/octet-stream';
    await sendAttachment({ fileName: file.name, mimeType, contentBase64: await readBlob(file), kind: inferType(mimeType, file.name), text: inputValue.trim() });
  };

  const handleMicClick = () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }
    if (interactionDisabled || !canRecord) return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mimeType = (typeof MediaRecorder.isTypeSupported === 'function' ? AUDIO_MIMES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) : '') ?? '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      streamRef.current = stream;
      chunksRef.current = [];
      recorder.ondataavailable = (entry) => { if (entry.data.size > 0) chunksRef.current.push(entry.data); };
      recorder.onstop = () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setIsRecording(false);
        setRecordingTime(0);
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (!blob.size) return;
        void readBlob(blob).then((contentBase64) => sendAttachment({ fileName: `voice-${Date.now()}.${AUDIO_EXT[type.toLowerCase()] ?? 'webm'}`, mimeType: type, contentBase64, kind: 'audio', text: inputValue.trim() }));
      };
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => setRecordingTime((value) => value + 1), 1000);
    }).catch(() => {});
  };

  const filteredSessions = sessions.filter((session) => session.title.toLowerCase().includes(searchQuery.toLowerCase()) || session.preview.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{ height: '100%', display: 'flex', background: C.bg, overflow: 'hidden', fontFamily: 'system-ui, sans-serif' }}>
      <aside style={{ width: 300, borderRight: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: '#fcfcfd' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>最近对话</div><div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>真实 TRIX Native 会话</div></div>
          <button title="刷新真实会话" onClick={() => void loadConversations()} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(99,14,212,0.08)', color: C.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><RefreshCw size={16} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.panel, borderRadius: 12, padding: '0 12px', height: 40 }}>
          <Search size={15} color={C.muted} />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索会话" style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', color: C.text, fontSize: 13 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredSessions.map((session) => (
            <button key={session.id} onClick={() => setActiveSessionId(session.id)} style={{ textAlign: 'left', border: 'none', background: session.id === activeSessionId ? 'rgba(99,14,212,0.08)' : C.white, borderRadius: 14, padding: '12px 14px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.title}</div>
                <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{session.updatedAt.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.preview || '新对话'}</div>
            </button>
          ))}
        </div>
      </aside>

      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ height: 60, padding: '0 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={18} color={C.primary} /></div>
          <div><div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{activeSession?.title ?? 'TRIX Native'}</div><div style={{ fontSize: 11, color: C.primary }}>{isSending ? 'TRIX 正在发送...' : activeSession ? 'TRIX Native 会话' : '等待真实会话'}</div></div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {(activeSession?.messages.length ?? 0) === 0 && !isSending ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>{sessions.length === 0 ? '暂无真实会话' : '向 TRIX 发起真实聊天'}</div>
                <div style={{ fontSize: 13 }}>{sessions.length === 0 ? '请先完成配对，再点击左上角刷新。' : '文本、图片、文件和语音都走真实 native 通道。'}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(activeSession?.messages ?? []).map((message) => <Bubble key={message.id} message={message} />)}
              {isSending && <div style={{ color: C.muted, fontSize: 12 }}>正在同步到 TRIX Native...</div>}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <footer style={{ padding: '0 24px 20px', position: 'relative' }}>
          <div style={{ background: C.panel, borderRadius: 16, padding: 12, borderBottom: `2px solid ${C.border}` }}>
            <textarea ref={textareaRef} value={inputValue} onChange={(event) => { setInputValue(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`; }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} disabled={composerDisabled} placeholder={composerDisabled ? '暂无真实会话，请先完成配对后刷新。' : '向 TRIX 提问或输入指令...'} rows={1} style={{ width: '100%', resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: composerDisabled ? `${C.muted}99` : C.text, fontSize: 14, lineHeight: 1.6, minHeight: 24, maxHeight: 160, overflowY: 'auto' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button title="附件" disabled={interactionDisabled} onClick={() => fileInputRef.current?.click()} style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: 'transparent', color: C.muted, opacity: interactionDisabled ? 0.45 : 1, cursor: interactionDisabled ? 'not-allowed' : 'pointer' }}><Paperclip size={16} /></button>
                <button title="表情" disabled={interactionDisabled} onClick={() => setShowEmoji((value) => !value)} style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: showEmoji ? C.panel2 : 'transparent', color: showEmoji ? C.primary : C.muted, opacity: interactionDisabled ? 0.45 : 1, cursor: interactionDisabled ? 'not-allowed' : 'pointer' }}><Smile size={16} /></button>
                <button title="图片" disabled={interactionDisabled} onClick={() => imageInputRef.current?.click()} style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: 'transparent', color: C.muted, opacity: interactionDisabled ? 0.45 : 1, cursor: interactionDisabled ? 'not-allowed' : 'pointer' }}><Image size={16} /></button>
                <button title={canRecord ? '语音' : '当前环境不支持录音'} disabled={interactionDisabled || !canRecord} onClick={handleMicClick} style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: isRecording ? 'rgba(220,38,38,0.08)' : 'transparent', color: isRecording ? '#dc2626' : C.muted, opacity: interactionDisabled || !canRecord ? 0.45 : 1, cursor: interactionDisabled || !canRecord ? 'not-allowed' : 'pointer' }}><Mic size={16} /></button>
                <input ref={imageInputRef} data-testid="chat-image-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                <input ref={fileInputRef} data-testid="chat-attachment-input" type="file" style={{ display: 'none' }} onChange={handleFileChange} />
              </div>
              <button title="发送" onClick={() => { void handleSend(); }} disabled={composerDisabled || !inputValue.trim() || isSending} style={{ height: 34, minWidth: 82, border: 'none', borderRadius: 10, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: composerDisabled || !inputValue.trim() || isSending ? 'rgba(123,116,135,0.18)' : `linear-gradient(135deg, ${C.primary}, ${C.primary2})`, color: C.white, fontSize: 13, fontWeight: 700, cursor: composerDisabled || !inputValue.trim() || isSending ? 'not-allowed' : 'pointer' }}>
                {isSending ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={14} />}
                {isSending ? '发送中' : '发送'}
              </button>
            </div>
          </div>

          {showEmoji && !composerDisabled && <div style={{ position: 'absolute', left: 24, bottom: 84, zIndex: 20, maxWidth: 280, padding: 10, borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>{EMOJIS.map((emoji) => <button key={emoji} onClick={() => { setInputValue((value) => value + emoji); setShowEmoji(false); textareaRef.current?.focus(); }} style={{ fontSize: 20, border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, borderRadius: 6 }}>{emoji}</button>)}</div>}
          <div style={{ position: 'absolute', right: 24, bottom: 76 }}>
            {isRecording ? <div style={{ padding: '8px 14px', borderRadius: 999, background: C.bg, border: '1px solid rgba(220,38,38,0.18)', color: '#dc2626', fontWeight: 700, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>{Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</div> : <button title="刷新真实会话" onClick={() => void loadConversations()} style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', background: `linear-gradient(135deg, ${C.primary}, ${C.primary2})`, color: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,14,212,0.28)' }}><RefreshCw size={20} /></button>}
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: C.muted, opacity: 0.45, marginTop: 8 }}>TRIX 可能会产生错误，请仔细核对重要信息。</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </footer>
      </section>
    </div>
  );
}
