import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Send, Paperclip, Smile, Image, Mic,
  Star, MoreVertical, Plus, Bot, User, Loader2,
} from 'lucide-react';
import { LuminaButton } from '../components/buttons';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: { type: 'image' | 'file'; url: string; name: string }[];
  suggestions?: string[];
  imageUrl?: string;
}

interface ChatSession {
  id: string;
  title: string;
  preview: string;
  updatedAt: Date;
  messages: ChatMessage[];
  isActive: boolean;
}

// ── TrixNativeServer API response shapes ─────────────────────────────────────

interface TrixConversation {
  id: string;
  title: string;
  updatedAt?: string;
}

interface TrixMessage {
  id: string;
  content: string;
  direction: 'incoming' | 'outgoing';
  timestamp: string;
}

// ── Design Tokens (Lumina) ────────────────────────────────────────────────────

const C = {
  primary: '#630ed4',
  primaryContainer: '#7c3aed',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#ede0ff',
  surfaceLowest: '#ffffff',
  surfaceLow: '#f2f4f6',
  surfaceHigh: '#e6e8ea',
  surfaceContainer: '#eceef0',
  onSurface: '#191c1e',
  onSurfaceVariant: '#4a4455',
  outline: '#7b7487',
  outlineVariant: '#ccc3d8',
  error: '#ba1a1a',
} as const;

// ── Mock / Demo fallback ─────────────────────────────────────────────────────

const DEMO_SESSIONS: ChatSession[] = [
  {
    id: 'demo-1',
    title: '产品原型设计讨论',
    preview: '好的，关于那个界面的玻璃拟态效果，我们可以尝试...',
    updatedAt: new Date(Date.now() - 1000 * 60 * 30),
    isActive: true,
    messages: [
      {
        id: 'm1',
        role: 'assistant',
        content: '你好！我已经准备好协助你进行产品原型设计的讨论了。我们可以从用户流程图开始，或者是先确定核心的功能模块。你目前有什么初步的想法吗？',
        timestamp: new Date(Date.now() - 1000 * 60 * 35),
        suggestions: ['查看相关文档', '生成思维导图'],
      },
      {
        id: 'm2',
        role: 'user',
        content: '我想重点讨论一下 AI 聊天界面的交互细节。我们需要一种能够体现"高级感"和"编辑感"的视觉风格。',
        timestamp: new Date(Date.now() - 1000 * 60 * 33),
      },
      {
        id: 'm3',
        role: 'assistant',
        content: '这是一个非常出色的切入点。为了实现"编辑感"，我建议采用以下几种设计策略：\n\n**超大间距**：通过非对称布局增加呼吸感\n**色调分层**：弃用描边，改用背景色阶区分空间',
        timestamp: new Date(Date.now() - 1000 * 60 * 31),
      },
      {
        id: 'm4',
        role: 'user',
        content: '具体说说色调分层怎么做？',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
      },
    ],
  },
  {
    id: 'demo-2',
    title: '量子计算基础',
    preview: '你能解释一下什么是量子纠缠吗？',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    isActive: false,
    messages: [
      {
        id: 'm5',
        role: 'user',
        content: '你能解释一下什么是量子纠缠吗？',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
      {
        id: 'm6',
        role: 'assistant',
        content: '量子纠缠是量子力学中最神奇的现象之一。当两个粒子处于纠缠态时，无论它们相距多远，对其中一个粒子的测量会瞬间影响另一个粒子的状态。',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 + 1000 * 60),
      },
    ],
  },
  {
    id: 'demo-3',
    title: '旅行行程规划',
    preview: '去京都的五天行程推荐有哪些？',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    isActive: false,
    messages: [],
  },
  {
    id: 'demo-4',
    title: 'Python 代码重构',
    preview: '请帮我审查这段数据清洗的代码逻辑。',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    isActive: false,
    messages: [],
  },
];

// ── API helper ────────────────────────────────────────────────────────────────

function parseApiConversations(result: { success: boolean; data?: TrixConversation[] }): ChatSession[] {
  if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
    return DEMO_SESSIONS;
  }
  return result.data.map((conv: TrixConversation, idx: number) => ({
    id: conv.id,
    title: conv.title || `对话 ${idx + 1}`,
    preview: '',
    updatedAt: conv.updatedAt ? new Date(conv.updatedAt) : new Date(),
    messages: [],
    isActive: idx === 0,
  }));
}

function parseApiMessages(result: { success: boolean; data?: TrixMessage[] }): ChatMessage[] {
  if (!result.success || !Array.isArray(result.data)) return [];
  return result.data.map((msg: TrixMessage) => ({
    id: msg.id,
    role: msg.direction === 'outgoing' ? 'user' : 'assistant',
    content: msg.content,
    timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
  }));
}

// ── Utilities ────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}小时前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatDateSeparator(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return '今天';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return '昨天';
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ChatBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        maxWidth: '72%',
        marginLeft: isUser ? 'auto' : 0,
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: isUser ? C.surfaceHigh : `${C.primaryContainer}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {isUser ? (
          <User size={14} color={C.onSurfaceVariant} />
        ) : (
          <Bot size={14} color={C.primary} />
        )}
      </div>

      {/* Bubble */}
      <div
        style={{
          background: isUser
            ? `linear-gradient(135deg, ${C.primary}, ${C.primaryContainer})`
            : C.surfaceLow,
          color: isUser ? C.onPrimary : C.onSurface,
          padding: '16px 20px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          boxShadow: isUser ? `0 4px 16px rgba(99,14,212,0.2)` : '0 1px 4px rgba(25,28,30,0.06)',
          flex: 1,
          minWidth: 0,
        }}
      >
        {message.imageUrl && (
          <div
            style={{
              borderRadius: 10,
              overflow: 'hidden',
              marginBottom: 10,
              maxHeight: 200,
            }}
          >
            <img
              src={message.imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.content}
        </p>

        {message.suggestions && message.suggestions.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {message.suggestions.map((s) => (
              <button
                key={s}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: `1px solid ${C.primary}30`,
                  background: `${C.primary}08`,
                  color: C.primary,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}18`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}08`;
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TypingIndicator = () => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, maxWidth: '72%' }}>
    <div
      style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${C.primaryContainer}20`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Bot size={14} color={C.primary} />
    </div>
    <div
      style={{
        background: C.surfaceLow,
        padding: '16px 20px',
        borderRadius: '16px 16px 16px 4px',
        display: 'flex', gap: 5, alignItems: 'center',
        boxShadow: '0 1px 4px rgba(25,28,30,0.06)',
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: C.outlineVariant,
            animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
    <style>{`
      @keyframes typingBounce {
        0%, 60%, 100% { transform: translateY(0); background: ${C.outlineVariant}; }
        30% { transform: translateY(-5px); background: ${C.primary}; }
      }
    `}</style>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatPage() {
  const api = window.electronAPI;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('demo-1');
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatHint, setShowNewChatHint] = useState(false);
  const [, setLoadingConversations] = useState(false);
  const [, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations on mount
  useEffect(() => {
    if (!api) {
      setSessions(DEMO_SESSIONS);
      return;
    }
    setLoadingConversations(true);
    api.listConversations().then((result: { success: boolean; data?: TrixConversation[] }) => {
      const parsed = parseApiConversations(result);
      setSessions(parsed);
      if (parsed.length > 0 && !parsed.find((s) => s.id === activeSessionId)) {
        setActiveSessionId(parsed[0]!.id);
      }
    }).catch(() => {
      setSessions(DEMO_SESSIONS);
    }).finally(() => {
      setLoadingConversations(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
  const filteredSessions = sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.preview.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Load messages when switching sessions
  const loadMessages = useCallback(async (sessionId: string, convId: string) => {
    if (!api || convId.startsWith('demo-')) return;
    setLoadingMessages(true);
    try {
      const result = await api.fetchMessages(convId) as { success: boolean; data?: TrixMessage[] };
      const messages = parseApiMessages(result);
      if (messages.length > 0) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, messages, preview: messages[messages.length - 1]?.content ?? '' }
              : s,
          ),
        );
      }
    } catch {
      // silently ignore — session stays with empty messages
    } finally {
      setLoadingMessages(false);
    }
  }, [api]);

  // When active session changes, load messages if not yet loaded
  useEffect(() => {
    if (activeSession && activeSession.messages.length === 0) {
      loadMessages(activeSession.id, activeSession.id);
    }
  }, [activeSessionId, activeSession, loadMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages.length, isTyping]);

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, userMsg], preview: userMsg.content, updatedAt: new Date() }
          : s,
      ),
    );
    setInputValue('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsTyping(true);

    const currentId = activeSessionId;

    if (api && !currentId.startsWith('demo-')) {
      // Real: POST to TrixNativeServer
      try {
        const result = await api.sendMessage(currentId, inputValue.trim()) as { success: boolean; data?: TrixMessage };
        if (result.success && result.data) {
          const aiMsg: ChatMessage = {
            id: result.data.id,
            role: 'assistant',
            content: result.data.content,
            timestamp: result.data.timestamp ? new Date(result.data.timestamp) : new Date(),
          };
          setIsTyping(false);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === currentId ? { ...s, messages: [...s.messages, aiMsg] } : s,
            ),
          );
          return;
        }
      } catch {
        // fall through to fallback
      }
    }

    // Fallback: simulate AI response after delay
    await new Promise((r) => setTimeout(r, 1600));
    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: '收到！让我思考一下这个问题。您的需求涉及多个层面，我会从设计、技术和用户体验三个维度来分析这个问题。\n\n从设计角度，建议采用渐进式披露的方式来处理复杂性。',
      timestamp: new Date(),
      suggestions: ['展开说说', '举一个例子'],
    };
    setIsTyping(false);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentId ? { ...s, messages: [...s.messages, aiMsg] } : s,
      ),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: ChatMessage[] }[] = [];
  activeSession?.messages.forEach((msg) => {
    const dateKey = formatDateSeparator(msg.timestamp);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateKey) {
      last.messages.push(msg);
    } else {
      groupedMessages.push({ date: dateKey, messages: [msg] });
    }
  });

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
        background: C.surfaceLowest,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          background: C.surfaceLow,
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${C.outlineVariant}20`,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 16px 12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: C.onSurfaceVariant,
                opacity: 0.5,
                margin: 0,
              }}
            >
              最近对话
            </h2>
            <button
              onClick={() => {
                const newId = `local-${Date.now()}`;
                const newSession: ChatSession = {
                  id: newId,
                  title: '新对话',
                  preview: '',
                  updatedAt: new Date(),
                  isActive: false,
                  messages: [],
                };
                setSessions((prev) => [newSession, ...prev]);
                setActiveSessionId(newId);
                setShowNewChatHint(true);
              }}
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                border: 'none',
                background: `${C.primary}12`,
                color: C.primary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = `${C.primary}12`;
              }}
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: C.onSurfaceVariant,
                opacity: 0.5,
              }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索历史消息..."
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                background: C.surfaceHigh,
                border: 'none',
                borderRadius: 999,
                fontSize: 13,
                color: C.onSurface,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'box-shadow 0.15s',
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.boxShadow = `0 0 0 2px ${C.primary}40`;
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        {/* Session List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 16px' }}>
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              style={{
                padding: '12px 12px',
                borderRadius: 12,
                cursor: 'pointer',
                background: session.id === activeSessionId ? C.surfaceLowest : 'transparent',
                border:
                  session.id === activeSessionId
                    ? `1px solid ${C.outlineVariant}40`
                    : '1px solid transparent',
                marginBottom: 2,
                transition: 'all 0.15s',
                boxShadow: session.id === activeSessionId ? '0 1px 4px rgba(25,28,30,0.06)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (session.id !== activeSessionId)
                  (e.currentTarget as HTMLDivElement).style.background = `${C.surfaceHigh}80`;
              }}
              onMouseLeave={(e) => {
                if (session.id !== activeSessionId)
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: session.id === activeSessionId ? 600 : 500,
                    color: session.id === activeSessionId ? C.primary : C.onSurface,
                  }}
                >
                  {session.title}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: C.onSurfaceVariant,
                    opacity: 0.6,
                    flexShrink: 0,
                    marginLeft: 6,
                  }}
                >
                  {formatTime(session.updatedAt)}
                </span>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: C.onSurfaceVariant,
                  opacity: 0.8,
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.4,
                }}
              >
                {session.preview || '新对话'}
              </p>
            </div>
          ))}
        </div>

        <style>{`
          ::-webkit-scrollbar { width: 3px; }
          ::-webkit-scrollbar-thumb { background: ${C.outlineVariant}; border-radius: 10px; }
          ::-webkit-scrollbar-track { background: transparent; }
        `}</style>
      </aside>

      {/* ── Chat Window ────────────────────────────────────────────────────── */}
      <section
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: C.surfaceLowest,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <header
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            borderBottom: `1px solid ${C.outlineVariant}20`,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: `${C.primaryContainer}20`,
                border: `1px solid ${C.primaryContainer}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={18} color={C.primary} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.onSurface }}>
                {activeSession?.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: C.primary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 1,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: isTyping ? '#fbbf24' : C.primary,
                    display: 'inline-block',
                  }}
                />
                {isTyping ? 'TRIX 正在输入...' : 'TRIX 智能助手'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { icon: Star, label: '收藏' },
              { icon: MoreVertical, label: '更多' },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                title={label}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: C.onSurfaceVariant,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = C.surfaceLow;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          {groupedMessages.length === 0 && !isTyping && (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  background: `${C.primary}10`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={28} color={C.primary} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: C.onSurface,
                    margin: '0 0 6px',
                  }}
                >
                  {showNewChatHint ? '开始新对话' : '与 TRIX 开始对话'}
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: C.onSurfaceVariant,
                    opacity: 0.7,
                    margin: 0,
                  }}
                >
                  有什么我可以帮你的吗？
                </p>
              </div>
              {/* Quick suggestions */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 }}>
                {['帮我写一段代码', '解释一个概念', '制定计划', '翻译内容'].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInputValue(q)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 999,
                      border: `1px solid ${C.outlineVariant}60`,
                      background: C.surfaceLow,
                      color: C.onSurfaceVariant,
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = C.primary;
                      (e.currentTarget as HTMLButtonElement).style.color = C.primary;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = `${C.outlineVariant}60`;
                      (e.currentTarget as HTMLButtonElement).style.color = C.onSurfaceVariant;
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {groupedMessages.map((group, gi) => (
            <div key={gi}>
              {/* Date Separator */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <span
                  style={{
                    padding: '3px 14px',
                    borderRadius: 999,
                    background: C.surfaceLow,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: C.onSurfaceVariant,
                    opacity: 0.6,
                  }}
                >
                  {group.date}
                </span>
              </div>

              {/* Messages */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 8 }}>
                {group.messages.map((msg) => (
                  <ChatBubble key={msg.id} message={msg} />
                ))}
              </div>

              {isTyping && gi === groupedMessages.length - 1 && (
                <div style={{ marginTop: 8 }}>
                  <TypingIndicator />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <footer
          style={{
            padding: '0 28px 24px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              background: C.surfaceLow,
              borderRadius: 16,
              padding: '12px 16px',
              borderBottom: `2px solid ${C.outlineVariant}`,
              transition: 'border-color 0.15s',
            }}
            onFocus={() => {}}
          >
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="向 TRIX 提问或输入指令..."
              rows={1}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: C.onSurface,
                resize: 'none',
                lineHeight: 1.6,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                minHeight: 24,
                maxHeight: 160,
                overflowY: 'auto',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 8,
                paddingTop: 8,
                borderTop: `1px solid ${C.outlineVariant}20`,
              }}
            >
              {/* Left toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {[
                  { icon: Paperclip, label: '附件' },
                  { icon: Smile, label: '表情' },
                  { icon: Image, label: '图片' },
                  { icon: Mic, label: '语音' },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    title={label}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: C.onSurfaceVariant,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = C.surfaceHigh;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>

              {/* Send button */}
              <LuminaButton
                variant="primary"
                size="sm"
                icon={isTyping ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={13} />}
                label={isTyping ? '发送中' : '发送'}
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping}
                loading={isTyping}
              />
            </div>
          </div>
          <p
            style={{
              textAlign: 'center',
              fontSize: 10,
              color: C.onSurfaceVariant,
              opacity: 0.4,
              marginTop: 8,
            }}
          >
            TRIX 可能会产生错误，请仔细核对重要信息
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </footer>
      </section>
    </div>
  );
}
