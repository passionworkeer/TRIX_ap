import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipForward, Clock, CheckSquare, Plus,
  Circle, Shield, Wifi, Cpu, Activity, CheckCircle,
  BookOpen, Zap,
} from 'lucide-react';

// ── Design Tokens ───────────────────────────────────────────────────────────

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
  success: '#16a34a',
} as const;

// ── Types ───────────────────────────────────────────────────────────────────

type PomodoroMode = 'focus' | 'shortBreak' | 'longBreak';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  deadline?: string;
}

interface PomodoroState {
  mode: PomodoroMode;
  timeLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_TODOS: TodoItem[] = [
  { id: '1', text: '完成 TRIX 原型设计稿', completed: false, priority: 'high', deadline: '今日' },
  { id: '2', text: '阅读量子计算第三章', completed: true, priority: 'medium' },
  { id: '3', text: '复习微积分重点公式', completed: false, priority: 'medium', deadline: '明日' },
  { id: '4', text: '整理学习笔记卡片', completed: false, priority: 'low' },
  { id: '5', text: '完成英语单词记忆计划', completed: false, priority: 'high', deadline: '今日' },
];

const MOCK_PROCESSES = [
  { name: '意图理解引擎', status: 'active', load: 42 },
  { name: '上下文记忆', status: 'active', load: 78 },
  { name: '知识检索', status: 'idle', load: 15 },
  { name: '响应生成', status: 'active', load: 91 },
];

const ACHIEVEMENTS = [
  { label: '连续7天学习', icon: '🏆', color: '#f59e0b' },
  { label: '完成100个番茄钟', icon: '🍅', color: '#ef4444' },
  { label: '累计学习100小时', icon: '📚', color: '#3b82f6' },
];

// ── Utilities ──────────────────────────────────────────────────────────────

const MODE_DURATIONS: Record<PomodoroMode, number> = {
  focus: 20 * 60 + 15,   // 20:15 in seconds
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface TagBadgeProps {
  label: string;
  color: string;
  bg: string;
  borderColor: string;
}

const TagBadge = (props: TagBadgeProps) => (
  <span
    style={{
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.03em',
      color: props.color,
      background: props.bg,
      border: `1px solid ${props.borderColor}`,
    }}
  >
    {props.label}
  </span>
);

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  size?: number;
  variant?: 'primary' | 'ghost' | 'surface';
  active?: boolean;
  disabled?: boolean;
}

const IconButton = (props: IconButtonProps) => {
  const {
    icon, label, onClick,
    variant = 'ghost', active = false, disabled = false,
  } = props;

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { width: 28, height: 28, borderRadius: 7 },
    md: { width: 36, height: 36, borderRadius: 9 },
    lg: { width: 44, height: 44, borderRadius: 11 },
  };

  const baseStyle = sizeStyles[props.size === 28 ? 'sm' : props.size === 44 ? 'lg' : 'md'];

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: `linear-gradient(135deg, ${C.primary}, ${C.primaryContainer})`,
      color: C.onPrimary,
      boxShadow: '0 2px 8px rgba(99,14,212,0.3)',
    },
    ghost: {
      background: active ? `${C.primary}14` : 'transparent',
      color: active ? C.primary : C.onSurfaceVariant,
    },
    surface: {
      background: C.surfaceLow,
      color: C.onSurface,
    },
  };

  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      style={{
        ...baseStyle,
        ...variants[variant],
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!disabled && variant !== 'primary') {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = active ? `${C.primary}20` : C.surfaceHigh;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && variant !== 'primary') {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.background = active ? `${C.primary}14` : 'transparent';
        }
      }}
    >
      {icon}
    </button>
  );
};

// ── Progress Bar ────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  gradient?: [string, string];
  height?: number;
  animated?: boolean;
}

const ProgressBar = (props: ProgressBarProps) => {
  const { value, max = 100, color = C.primary, gradient, height = 6, animated = false } = props;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      style={{
        width: '100%',
        height,
        background: C.outlineVariant,
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: gradient ? `linear-gradient(90deg, ${gradient[0]}, ${gradient[1]})` : color,
          borderRadius: 999,
          transition: animated ? 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}
      />
    </div>
  );
};

// ── Pomodoro Timer ──────────────────────────────────────────────────────────

const PomodoroTimer = () => {
  const [state, setState] = useState<PomodoroState>({
    mode: 'focus',
    timeLeft: MODE_DURATIONS.focus,
    isRunning: false,
    sessionsCompleted: 3,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalTime = MODE_DURATIONS[state.mode];
  const progress = 1 - state.timeLeft / totalTime;
  const RADIUS = 70;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC * (1 - progress);

  const handleModeSwitch = useCallback((mode: PomodoroMode) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState((prev) => ({ ...prev, mode, timeLeft: MODE_DURATIONS[mode], isRunning: false }));
  }, []);

  const toggleTimer = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: !prev.isRunning }));
  }, []);

  const skipSession = useCallback(() => {
    const nextMode: PomodoroState['mode'] =
      state.mode === 'focus'
        ? state.sessionsCompleted > 0 && (state.sessionsCompleted + 1) % 4 === 0
          ? 'longBreak'
          : 'shortBreak'
        : 'focus';
    const newSessions = state.mode === 'focus' ? state.sessionsCompleted + 1 : state.sessionsCompleted;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState((prev) => ({
      ...prev,
      mode: nextMode,
      timeLeft: MODE_DURATIONS[nextMode],
      isRunning: false,
      sessionsCompleted: newSessions,
    }));
  }, [state.mode, state.sessionsCompleted]);

  // Countdown effect
  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.timeLeft <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            // Auto-advance to next session
            const nextMode: PomodoroState['mode'] =
              prev.mode === 'focus'
                ? prev.sessionsCompleted > 0 && (prev.sessionsCompleted + 1) % 4 === 0
                  ? 'longBreak'
                  : 'shortBreak'
                : 'focus';
            const newSessions = prev.mode === 'focus' ? prev.sessionsCompleted + 1 : prev.sessionsCompleted;
            return {
              ...prev,
              mode: nextMode,
              timeLeft: MODE_DURATIONS[nextMode],
              isRunning: false,
              sessionsCompleted: newSessions,
            };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.isRunning]);

  const modeColors: Record<PomodoroMode, string> = {
    focus: C.primary,
    shortBreak: '#16a34a',
    longBreak: '#0369a1',
  };

  const modeGradients: Record<PomodoroMode, [string, string]> = {
    focus: [C.primary, C.primaryContainer],
    shortBreak: ['#16a34a', '#15803d'],
    longBreak: ['#0369a1', '#075985'],
  };

  const activeColor = modeColors[state.mode];
  const activeGradient = modeGradients[state.mode];

  return (
    <div
      style={{
        background: C.surfaceLowest,
        borderRadius: 8,
        padding: '20px 16px',
        border: `1px solid ${C.outlineVariant}40`,
        boxShadow: '0 1px 4px rgba(25,28,30,0.05)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Clock size={14} color={activeColor} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: activeColor,
          }}
        >
          番茄钟
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: C.onSurfaceVariant,
            opacity: 0.6,
          }}
        >
          第 {state.sessionsCompleted + 1} 个番茄
        </span>
      </div>

      {/* SVG Ring */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <svg width="172" height="172" viewBox="0 0 172 172">
          {/* Track */}
          <circle
            cx="86" cy="86" r={RADIUS}
            fill="none"
            stroke={C.outlineVariant}
            strokeWidth="10"
            opacity="0.4"
          />
          {/* Progress */}
          <circle
            cx="86" cy="86" r={RADIUS}
            fill="none"
            stroke={`url(#pomodoro-gradient-${state.mode})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 86 86)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
          <defs>
            <linearGradient id={`pomodoro-gradient-focus`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={C.primary} />
              <stop offset="100%" stopColor={C.primaryContainer} />
            </linearGradient>
            <linearGradient id="pomodoro-gradient-shortBreak" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
            <linearGradient id="pomodoro-gradient-longBreak" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0369a1" />
              <stop offset="100%" stopColor="#075985" />
            </linearGradient>
          </defs>

          {/* Center text */}
          <text
            x="86" y="78"
            textAnchor="middle"
            fontSize="30"
            fontWeight="700"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill={C.onSurface}
          >
            {formatTime(state.timeLeft)}
          </text>
          <text
            x="86" y="100"
            textAnchor="middle"
            fontSize="11"
            fontFamily="system-ui, -apple-system, sans-serif"
            fill={C.onSurfaceVariant}
            opacity="0.7"
          >
            {MODE_LABELS[state.mode]}
          </text>
        </svg>
      </div>

      {/* Mode Tabs */}
      <div
        style={{
          display: 'flex',
          background: C.surfaceLow,
          borderRadius: 9,
          padding: 3,
          marginBottom: 14,
        }}
      >
        {(['focus', 'shortBreak', 'longBreak'] as PomodoroMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => handleModeSwitch(mode)}
            style={{
              flex: 1,
              padding: '5px 4px',
              borderRadius: 7,
              border: 'none',
              background: state.mode === mode ? C.surfaceLowest : 'transparent',
              color: state.mode === mode ? activeColor : C.onSurfaceVariant,
              fontSize: 11,
              fontWeight: state.mode === mode ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: state.mode === mode ? '0 1px 3px rgba(25,28,30,0.1)' : 'none',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <IconButton
          icon={<SkipForward size={14} />}
          label="跳过"
          onClick={skipSession}
          variant="ghost"
          size={32}
        />
        <IconButton
          icon={
            state.isRunning ? (
              <Pause size={16} color={C.onPrimary} />
            ) : (
              <Play size={16} color={C.onPrimary} />
            )
          }
          label={state.isRunning ? '暂停' : '开始'}
          onClick={toggleTimer}
          variant="primary"
          size={44}
        />
        <div style={{ width: 32 }} />
      </div>

      {/* Sessions indicator */}
      <div
        style={{
          display: 'flex',
          gap: 5,
          justifyContent: 'center',
          marginTop: 14,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background:
                i < (state.sessionsCompleted % 4)
                  ? activeGradient[0]
                  : C.outlineVariant,
              opacity: i < (state.sessionsCompleted % 4) ? 1 : 0.4,
              transition: 'all 0.3s',
            }}
          />
        ))}
      </div>
    </div>
  );
};

// ── AI Heartbeat Panel ─────────────────────────────────────────────────────

const AIHeartbeat = () => (
  <div
    style={{
      background: C.surfaceLowest,
      borderRadius: 8,
      padding: '16px',
      border: `1px solid ${C.outlineVariant}40`,
      boxShadow: '0 1px 4px rgba(25,28,30,0.05)',
    }}
  >
    {/* Header */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Wifi size={13} color={C.primary} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: C.primary,
        }}
      >
        TRIX 认知状态
      </span>
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#22c55e',
            animation: 'heartbeat-pulse 2s ease-in-out infinite',
          }}
        />
        <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>在线</span>
      </div>
      <style>{`
        @keyframes heartbeat-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
      `}</style>
    </div>

    {/* Metrics */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
      <MetricRow
        icon={<Cpu size={11} />}
        label="认知负载"
        value="67%"
        progress={67}
        color={C.primary}
      />
      <MetricRow
        icon={<Activity size={11} />}
        label="响应潜伏"
        value="142ms"
        progress={42}
        color="#8b5cf6"
      />
    </div>

    {/* Process list */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {MOCK_PROCESSES.map((proc) => (
        <div
          key={proc.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 7,
            background: proc.status === 'active' ? `${C.primary}06` : 'transparent',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: proc.status === 'active' ? '#22c55e' : C.outlineVariant,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: C.onSurface,
              flex: 1,
              fontWeight: proc.status === 'active' ? 600 : 400,
            }}
          >
            {proc.name}
          </span>
          <span
            style={{
              fontSize: 10,
              color: C.onSurfaceVariant,
              opacity: 0.7,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {proc.load}%
          </span>
        </div>
      ))}
    </div>
  </div>
);

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  progress: number;
  color: string;
}

const MetricRow = (props: MetricRowProps) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
      <span style={{ color: C.onSurfaceVariant }}>{props.icon}</span>
      <span style={{ fontSize: 11, color: C.onSurfaceVariant }}>{props.label}</span>
      <span
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          fontWeight: 700,
          color: props.color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {props.value}
      </span>
    </div>
    <ProgressBar
      value={props.progress}
      max={100}
      color={props.color}
      height={4}
      animated
    />
  </div>
);

// ── Security CTA Card ───────────────────────────────────────────────────────

const SecurityCTA = () => (
  <div
    style={{
      background: `linear-gradient(135deg, ${C.primary}14, ${C.primaryContainer}20)`,
      borderRadius: 8,
      padding: '16px',
      border: `1px solid ${C.primary}20`,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}
  >
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        background: `linear-gradient(135deg, ${C.primary}, ${C.primaryContainer})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(99,14,212,0.25)',
      }}
    >
      <Shield size={16} color={C.onPrimary} />
    </div>
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.primary,
          marginBottom: 2,
          letterSpacing: '0.02em',
        }}
      >
        数据安全保护
      </div>
      <div
        style={{
          fontSize: 10,
          color: C.onSurfaceVariant,
          lineHeight: 1.4,
        }}
      >
        256-bit 端对端加密保护
      </div>
    </div>
  </div>
);

// ── Main StudyPage Component ─────────────────────────────────────────────────

export default function StudyPage() {
  const [activeTab, setActiveTab] = useState<'focus' | 'courses' | 'stats'>('focus');
  const [todos, setTodos] = useState<TodoItem[]>(MOCK_TODOS);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  const tabs = [
    { key: 'focus' as const, label: '专注模式' },
    { key: 'courses' as const, label: '课程资料' },
    { key: 'stats' as const, label: '统计报表' },
  ];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#f7f9fb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        style={{
          padding: '20px 28px 0',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: C.onSurface,
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              学习工作台
            </h1>
            <p
              style={{
                fontSize: 12,
                color: C.onSurfaceVariant,
                margin: '4px 0 0',
                opacity: 0.7,
              }}
            >
              专注、高效、有序
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                background: `${C.primary}10`,
                border: `1px solid ${C.primary}20`,
              }}
            >
              <Zap size={12} color={C.primary} />
              <span style={{ fontSize: 11, color: C.primary, fontWeight: 600 }}>
                专注中
              </span>
            </div>
          </div>
        </div>

        {/* Sub-nav tabs */}
        <nav style={{ display: 'flex', gap: 2 }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '7px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.key ? C.primary : 'transparent'}`,
                background: activeTab === tab.key ? C.surfaceLowest : 'transparent',
                color: activeTab === tab.key ? C.primary : C.onSurfaceVariant,
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 20,
          padding: '20px 28px 24px',
          overflow: 'hidden',
        }}
      >
        {/* ── Left Column (7 cols / ~58%) ─────────────────────────────────────── */}
        <div
          style={{
            flex: '0 0 58%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {/* Editorial Quote */}
          <div
            style={{
              background: `linear-gradient(135deg, ${C.primary}08, ${C.primaryContainer}14)`,
              borderRadius: 8,
              padding: '20px 20px 20px 22px',
              border: `1px solid ${C.primary}14`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Decorative gradient circle */}
            <div
              style={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 90,
                height: 90,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${C.primaryContainer}30, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <BookOpen size={18} color={C.primary} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.8,
                    color: C.onSurface,
                    margin: 0,
                    fontStyle: 'italic',
                    fontWeight: 500,
                  }}
                >
                  "学习的本质，不在于记忆多少，而在于理解多深；不在于速度，而在于持续。"
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: C.onSurfaceVariant,
                    margin: '8px 0 0',
                    opacity: 0.6,
                  }}
                >
                  — TRIX 学习箴言
                </p>
              </div>
            </div>
          </div>

          {/* Current Task Card */}
          <div
            style={{
              background: C.surfaceLowest,
              borderRadius: 8,
              padding: '18px 20px',
              border: `1px solid ${C.outlineVariant}40`,
              boxShadow: '0 1px 4px rgba(25,28,30,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.onSurface, marginBottom: 2 }}>
                  今日专注任务
                </div>
                <div style={{ fontSize: 11, color: C.onSurfaceVariant, opacity: 0.7 }}>
                  2026年3月22日 · 周日
                </div>
              </div>
              <button
                style={{
                  padding: '4px 12px',
                  borderRadius: 7,
                  border: `1px solid ${C.outlineVariant}60`,
                  background: C.surfaceLow,
                  color: C.onSurfaceVariant,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = C.primary;
                  el.style.color = C.primary;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = `${C.outlineVariant}60`;
                  el.style.color = C.onSurfaceVariant;
                }}
              >
                编辑
              </button>
            </div>

            {/* Progress */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: C.primary,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                4.5
              </span>
              <span style={{ fontSize: 13, color: C.onSurfaceVariant }}>小时</span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: C.onSurfaceVariant,
                  opacity: 0.6,
                }}
              >
                目标 8h
              </span>
            </div>
            <ProgressBar
              value={4.5}
              max={8}
              gradient={[C.primary, C.primaryContainer]}
              height={7}
              animated
            />
          </div>

          {/* Bento: Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <StatCard
              icon={<Clock size={16} />}
              label="今日专注时长"
              value="4h 32m"
              sub="较昨日 +18%"
              color={C.primary}
              colorBg={`${C.primary}10`}
            />
            <StatCard
              icon={<CheckCircle size={16} />}
              label="已完成任务"
              value="8 / 12"
              sub="完成率 67%"
              color="#16a34a"
              colorBg="#16a34a10"
            />
          </div>

          {/* Achievement Badges */}
          <div
            style={{
              background: C.surfaceLowest,
              borderRadius: 8,
              padding: '14px 16px',
              border: `1px solid ${C.outlineVariant}40`,
              boxShadow: '0 1px 4px rgba(25,28,30,0.05)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: C.onSurfaceVariant, marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.6 }}>
              成就徽章
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {ACHIEVEMENTS.map((a) => (
                <div
                  key={a.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: 10,
                    background: `${a.color}10`,
                    border: `1px solid ${a.color}25`,
                    cursor: 'default',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: a.color,
                      fontWeight: 600,
                      textAlign: 'center',
                      lineHeight: 1.3,
                    }}
                  >
                    {a.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Todo List */}
          <div
            style={{
              background: C.surfaceLowest,
              borderRadius: 8,
              padding: '16px 18px',
              border: `1px solid ${C.outlineVariant}40`,
              boxShadow: '0 1px 4px rgba(25,28,30,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.onSurface }}>
                待办事项
              </div>
              <span style={{ fontSize: 10, color: C.onSurfaceVariant, opacity: 0.5 }}>
                {todos.filter((t) => t.completed).length}/{todos.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  onClick={() => toggleTodo(todo.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = `${C.primary}05`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  {todo.completed ? (
                    <CheckSquare
                      size={15}
                      color={C.primary}
                      style={{ flexShrink: 0 }}
                    />
                  ) : (
                    <Circle
                      size={15}
                      color={C.outlineVariant}
                      style={{ flexShrink: 0 }}
                    />
                  )}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: todo.completed ? C.onSurfaceVariant : C.onSurface,
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      opacity: todo.completed ? 0.5 : 1,
                      transition: 'all 0.2s',
                    }}
                  >
                    {todo.text}
                  </span>
                  {todo.deadline && (
                    <TagBadge
                      label={todo.deadline}
                      color="#0369a1"
                      bg="#e0f2fe"
                      borderColor="#bae6fd"
                    />
                  )}
                  <TagBadge
                    label={{ high: '高', medium: '中', low: '低' }[todo.priority]}
                    color={
                      todo.priority === 'high'
                        ? C.error
                        : todo.priority === 'medium'
                        ? '#d97706'
                        : C.onSurfaceVariant
                    }
                    bg={
                      todo.priority === 'high'
                        ? '#fee2e2'
                        : todo.priority === 'medium'
                        ? '#fef3c7'
                        : C.surfaceLow
                    }
                    borderColor={
                      todo.priority === 'high'
                        ? '#fecaca'
                        : todo.priority === 'medium'
                        ? '#fde68a'
                        : C.outlineVariant
                    }
                  />
                </div>
              ))}
            </div>

            {/* Add task button */}
            <button
              style={{
                width: '100%',
                marginTop: 10,
                padding: '8px',
                borderRadius: 8,
                border: `1.5px dashed ${C.outlineVariant}`,
                background: 'transparent',
                color: C.onSurfaceVariant,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.15s',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = C.primary;
                el.style.color = C.primary;
                el.style.background = `${C.primary}05`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = C.outlineVariant;
                el.style.color = C.onSurfaceVariant;
                el.style.background = 'transparent';
              }}
            >
              <Plus size={13} />
              添加任务
            </button>
          </div>
        </div>

        {/* ── Right Column (5 cols / ~42%) ───────────────────────────────────── */}
        <div
          style={{
            flex: '0 0 40%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
          }}
        >
          <PomodoroTimer />
          <AIHeartbeat />
          <SecurityCTA />

          {/* Quick Stats */}
          <div
            style={{
              background: C.surfaceLowest,
              borderRadius: 8,
              padding: '16px',
              border: `1px solid ${C.outlineVariant}40`,
              boxShadow: '0 1px 4px rgba(25,28,30,0.05)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.onSurfaceVariant,
                marginBottom: 12,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                opacity: 0.6,
              }}
            >
              本周概览
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <QuickStat label="专注总时长" value="28h 15m" icon={<Clock size={12} />} />
              <QuickStat label="完成番茄钟" value="45 个" icon={<CheckCircle size={12} />} />
              <QuickStat label="学习天数" value="连续 12 天" icon={<Activity size={12} />} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${C.outlineVariant}; border-radius: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}

// ── Supporting Sub-components ────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
  colorBg: string;
}

const StatCard = (props: StatCardProps) => (
  <div
    style={{
      background: C.surfaceLowest,
      borderRadius: 8,
      padding: '16px',
      border: `1px solid ${C.outlineVariant}40`,
      boxShadow: '0 1px 4px rgba(25,28,30,0.05)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 9,
        background: props.colorBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{ color: props.color }}>{props.icon}</span>
    </div>
    <div>
      <div
        style={{
          fontSize: 10,
          color: C.onSurfaceVariant,
          opacity: 0.7,
          marginBottom: 3,
          fontWeight: 500,
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: C.onSurface,
          lineHeight: 1,
          marginBottom: 3,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {props.value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: props.color,
          fontWeight: 600,
        }}
      >
        {props.sub}
      </div>
    </div>
  </div>
);

interface QuickStatProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

const QuickStat = (props: QuickStatProps) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      borderBottom: `1px solid ${C.outlineVariant}20`,
    }}
  >
    <span style={{ color: C.onSurfaceVariant, opacity: 0.6 }}>{props.icon}</span>
    <span style={{ fontSize: 12, color: C.onSurfaceVariant, flex: 1 }}>{props.label}</span>
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: C.onSurface,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {props.value}
    </span>
  </div>
);
