import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LuminaTabBar } from '../../../shared/components/LuminaTabBar';
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

// ── Demo fallback data ────────────────────────────────────────────────────────

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
  const api = window.electronAPI;
  const [state, setState] = useState<PomodoroState>({
    mode: 'focus',
    timeLeft: MODE_DURATIONS.focus,
    isRunning: false,
    sessionsCompleted: 0,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const sessionStartTimeRef = useRef<number | null>(null);

  const totalTime = MODE_DURATIONS[state.mode];
  const progress = 1 - state.timeLeft / totalTime;
  const RADIUS = 70;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC * (1 - progress);

  // Create study session in Supabase
  const createStudySession = useCallback(async () => {
    if (!api?.createStudySession) return null;
    try {
      const result = await api.createStudySession('自习');
      if (result.success && result.data?.id) {
        return result.data.id;
      }
    } catch (e) {
      console.error('Failed to create study session:', e);
    }
    return null;
  }, [api]);

  // Update study session in Supabase
  const updateStudySession = useCallback(async (sessionId: string, durationMinutes: number) => {
    if (!api?.updateStudySession) return;
    try {
      await api.updateStudySession(sessionId, durationMinutes);
    } catch (e) {
      console.error('Failed to update study session:', e);
    }
  }, [api]);

  // Handle focus session completion
  const handleFocusComplete = useCallback(async () => {
    const sessionId = currentSessionIdRef.current;
    const startTime = sessionStartTimeRef.current;
    
    if (sessionId && startTime) {
      const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
      const durationMinutes = Math.min(elapsedMinutes, MODE_DURATIONS.focus / 60);
      await updateStudySession(sessionId, durationMinutes);
    }
    
    currentSessionIdRef.current = null;
    sessionStartTimeRef.current = null;
  }, [updateStudySession]);

  const handleModeSwitch = useCallback(async (mode: PomodoroMode) => {
    // If switching away from focus, save the session
    if (state.mode === 'focus' && state.isRunning) {
      await handleFocusComplete();
    }
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState((prev) => ({ ...prev, mode, timeLeft: MODE_DURATIONS[mode], isRunning: false }));
  }, [state.mode, state.isRunning, handleFocusComplete]);

  const toggleTimer = useCallback(async () => {
    if (state.isRunning) {
      // Pausing - save the session
      await handleFocusComplete();
      if (intervalRef.current) clearInterval(intervalRef.current);
      setState((prev) => ({ ...prev, isRunning: false }));
    } else {
      // Starting - create a new session if in focus mode
      if (state.mode === 'focus') {
        const sessionId = await createStudySession();
        if (sessionId) {
          currentSessionIdRef.current = sessionId;
          sessionStartTimeRef.current = Date.now();
        }
      }
      setState((prev) => ({ ...prev, isRunning: true }));
    }
  }, [state.isRunning, state.mode, handleFocusComplete, createStudySession]);

  const skipSession = useCallback(async () => {
    // Save current focus session if running
    if (state.mode === 'focus' && state.isRunning) {
      await handleFocusComplete();
    }
    
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
  }, [state.mode, state.sessionsCompleted, state.isRunning, handleFocusComplete]);

  // Countdown effect
  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.timeLeft <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            
            // Handle focus completion
            if (prev.mode === 'focus') {
              handleFocusComplete();
            }
            
            // Auto-advance to next session
            const nextMode: PomodoroState['mode'] =
              prev.mode === 'focus'
                ? prev.sessionsCompleted > 0 && (prev.sessionsCompleted + 1) % 4 === 0
                  ? 'longBreak'
                  : 'shortBreak'
                : 'focus';
            const newSessions = prev.mode === 'focus' ? prev.sessionsCompleted + 1 : prev.sessionsCompleted;
            
            // Create new session if going to focus mode
            if (nextMode === 'focus') {
              createStudySession().then(sessionId => {
                if (sessionId) {
                  currentSessionIdRef.current = sessionId;
                  sessionStartTimeRef.current = Date.now();
                }
              });
            }
            
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
  }, [state.isRunning, handleFocusComplete, createStudySession]);

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

interface SystemMetrics {
  cpu: { usage: number };
  memory: { used: number; total: number; usage: number };
  gateway?: { latencyMs?: number; status?: string };
}

interface AIHeartbeatProps {
  metrics: SystemMetrics | null;
  loading: boolean;
}

const AIHeartbeat: React.FC<AIHeartbeatProps> = ({ metrics, loading }) => (
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
      {loading ? (
        <>
          <MetricRow icon={<Cpu size={11} />} label="认知负载" value="加载中..." progress={0} color={C.primary} />
          <MetricRow icon={<Activity size={11} />} label="响应潜伏" value="—" progress={0} color="#8b5cf6" />
        </>
      ) : metrics ? (
        <>
          <MetricRow
            icon={<Cpu size={11} />}
            label="CPU 使用率"
            value={`${metrics.cpu.usage}%`}
            progress={metrics.cpu.usage}
            color={C.primary}
          />
          <MetricRow
            icon={<Activity size={11} />}
            label="响应潜伏"
            value={metrics.gateway?.latencyMs != null ? `${metrics.gateway.latencyMs}ms` : '—'}
            progress={metrics.gateway?.latencyMs != null ? Math.min(metrics.gateway.latencyMs, 200) : 0}
            color="#8b5cf6"
          />
        </>
      ) : (
        <>
          <MetricRow icon={<Cpu size={11} />} label="CPU 使用率" value="离线" progress={0} color={C.primary} />
          <MetricRow icon={<Activity size={11} />} label="响应潜伏" value="离线" progress={0} color="#8b5cf6" />
        </>
      )}
    </div>

    {/* System info rows */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {loading ? (
        <div style={{ fontSize: 11, color: C.onSurfaceVariant, textAlign: 'center', padding: '8px 0' }}>
          加载系统信息...
        </div>
      ) : metrics ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ fontSize: 11, color: C.onSurfaceVariant, flex: 1 }}>内存</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
              {metrics.memory.used} / {metrics.memory.total} GB ({metrics.memory.usage}%)
            </span>
          </div>
          <ProgressBar value={metrics.memory.usage} max={100} color="#16a34a" height={4} animated />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ fontSize: 11, color: C.onSurfaceVariant, flex: 1 }}>Gateway</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: metrics.gateway?.status === 'healthy' ? '#22c55e' : '#f59e0b' }}>
              {metrics.gateway?.status === 'healthy' ? '在线' : metrics.gateway?.status === 'degraded' ? '降级' : '离线'}
            </span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 11, color: '#f59e0b', textAlign: 'center', padding: '8px 0' }}>
          无法获取系统信息
        </div>
      )}
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

// ── Courses Tab Content ──────────────────────────────────────────────────────

const CoursesTabContent: React.FC = () => (
  <div
    style={{
      background: C.surfaceLowest,
      borderRadius: 12,
      border: `1px solid ${C.outlineVariant}40`,
      padding: '28px 24px',
      boxShadow: '0 1px 4px rgba(25,28,30,0.05)',
    }}
  >
    <div style={{ fontSize: 14, fontWeight: 700, color: C.onSurface, marginBottom: 8 }}>
      暂无课程资料
    </div>
    <div style={{ fontSize: 12, color: C.onSurfaceVariant, lineHeight: 1.7 }}>
      当前桌面端还没有接入真实课程数据源，所以这里不会再展示演示课程卡片。
      等课程服务接入后，这里会直接展示真实课程、进度和课时信息。
    </div>
  </div>
);

// ── Stats Tab Content ────────────────────────────────────────────────────────

const StatCardItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}> = ({ icon, label, value, color, bg }) => (
  <div style={{
    background: C.surfaceLowest,
    borderRadius: 12,
    border: `1px solid ${C.outlineVariant}40`,
    padding: '16px',
    display: 'flex',
    gap: 12,
    boxShadow: '0 1px 4px rgba(25,28,30,0.05)',
  }}>
    <div style={{
      width: 36,
      height: 36,
      borderRadius: 9,
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{ color }}>{icon}</span>
    </div>
    <div>
      <div style={{ fontSize: 10, color: C.onSurfaceVariant, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.onSurface }}>{value}</div>
    </div>
  </div>
);

interface StatsTabContentProps {
  studyStats: StudyStats;
  loading: boolean;
}

const formatMins = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const StatsTabContent: React.FC<StatsTabContentProps> = ({ studyStats, loading }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ height: 72, borderRadius: 12, background: C.outlineVariant + '20' }} />)}
        </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatCardItem icon={<Clock size={16} />} label="累计学习时长" value={formatMins(studyStats.totalMinutes)} color={C.primary} bg={`${C.primary}10`} />
        <StatCardItem icon={<CheckCircle size={16} />} label="学习会话数" value={`${studyStats.sessionCount} 个`} color="#16a34a" bg="#16a34a10" />
        <StatCardItem icon={<Activity size={16} />} label="今日学习时长" value={formatMins(studyStats.todayMinutes)} color="#0369a1" bg="#0369a115" />
        <StatCardItem icon={<Zap size={16} />} label="本周学习时长" value={formatMins(studyStats.weekMinutes)} color="#d97706" bg="#d9770610" />
      </div>
      )}

      {/* Summary chart — simple bar from weekly minutes */}
      <div style={{
        background: C.surfaceLowest,
        borderRadius: 12,
        border: `1px solid ${C.outlineVariant}40`,
        padding: '20px',
        boxShadow: '0 1px 4px rgba(25,28,30,0.05)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.onSurface, marginBottom: 16 }}>学习统计</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: C.onSurfaceVariant, width: 80 }}>今日</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: `${C.primary}15` }}>
              <div style={{ width: `${Math.min((studyStats.todayMinutes / 60) / 8 * 100, 100)}%`, height: '100%', borderRadius: 4, background: C.primary }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.primary, width: 50, textAlign: 'right' }}>{formatMins(studyStats.todayMinutes)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: C.onSurfaceVariant, width: 80 }}>本周</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: `${C.primary}15` }}>
              <div style={{ width: `${Math.min((studyStats.weekMinutes / 60) / 40 * 100, 100)}%`, height: '100%', borderRadius: 4, background: '#16a34a' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', width: 50, textAlign: 'right' }}>{formatMins(studyStats.weekMinutes)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: C.onSurfaceVariant, width: 80 }}>累计</span>
            <div style={{ flex: 1, height: 8, borderRadius: 4, background: `${C.primary}15` }}>
              <div style={{ width: `${Math.min((studyStats.totalMinutes / 60) / 1000 * 100, 100)}%`, height: '100%', borderRadius: 4, background: '#0369a1' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', width: 50, textAlign: 'right' }}>{formatMins(studyStats.totalMinutes)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Study Room Component ──────────────────────────────────────────────────────

type EntryMode = 'self' | 'friend' | 'room';

interface StudyRoomProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  displayName: string;
  avatarUrl?: string;
}

interface StudyRoomMember {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  joinedAt: number;
  lastActiveAt: number;
  status: 'online' | 'focusing' | 'resting';
}

interface StudyRoomState {
  roomCode: string;
  hostUserId: string;
  sessionState: 'idle' | 'focusing' | 'resting';
  members: StudyRoomMember[];
  maxMembers: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  timer: {
    durationSeconds: number;
    startedAt: number;
    endsAt: number;
    remainingSeconds: number;
  } | null;
}

const StudyRoom: React.FC<StudyRoomProps> = ({ isOpen, onClose, currentUserId, displayName, avatarUrl }) => {
  const api = window.electronAPI;
  const [entryMode, setEntryMode] = useState<EntryMode>('self');
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [room, setRoom] = useState<StudyRoomState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = room?.hostUserId === currentUserId;

  // Refresh room state
  const refreshRoom = useCallback(async () => {
    if (!room?.roomCode || !api) return;
    const result = await api.getStudyRoom(room.roomCode);
    if (result.success && result.data) {
      setRoom(result.data);
    } else {
      setRoom(null);
    }
  }, [api, room?.roomCode]);

  // Poll room state every 5 seconds when in a room
  useEffect(() => {
    if (!room || !isOpen) return;
    const interval = setInterval(refreshRoom, 5000);
    return () => clearInterval(interval);
  }, [room, isOpen, refreshRoom]);

  const handleCreateRoom = async () => {
    if (!api) return;
    setIsBusy(true);
    setError(null);
    const result = await api.createStudyRoom({
      userId: currentUserId,
      displayName,
      avatarUrl,
      maxMembers: 5
    });
    setIsBusy(false);
    if (result.success && result.data) {
      setRoom(result.data);
      setRoomCodeInput(result.data.roomCode);
    } else {
      setError(result.error || '创建房间失败');
    }
  };

  const handleJoinRoom = async () => {
    if (!api) return;
    const code = roomCodeInput.trim().toUpperCase();
    if (!code || code.length < 4) {
      setError('请输入有效的房间号');
      return;
    }
    setIsBusy(true);
    setError(null);
    const result = await api.joinStudyRoom(code, {
      userId: currentUserId,
      displayName,
      avatarUrl
    });
    setIsBusy(false);
    if (result.success && result.data) {
      setRoom(result.data);
    } else {
      setError(result.error || '加入房间失败');
    }
  };

  const handleLeaveRoom = async () => {
    if (!room || !api) return;
    setIsBusy(true);
    setError(null);
    await api.leaveStudyRoom(room.roomCode, currentUserId);
    setIsBusy(false);
    setRoom(null);
    setRoomCodeInput('');
  };

  const handleHostAction = async (action: 'start_focus' | 'pause' | 'end') => {
    if (!room || !api) return;
    setIsBusy(true);
    setError(null);
    const result = await api.studyRoomHostAction(room.roomCode, {
      userId: currentUserId,
      action,
      durationMinutes: action === 'start_focus' ? selectedDuration : undefined
    });
    setIsBusy(false);
    if (result.success && result.data) {
      setRoom(result.data);
    } else {
      setError(result.error || '操作失败');
    }
  };

  const handleStartSelfStudy = () => {
    onClose();
    // Trigger self study with selected duration
    window.dispatchEvent(new CustomEvent('start-self-study', { detail: { duration: selectedDuration } }));
  };

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'focusing': return '#16a34a';
      case 'resting': return '#f59e0b';
      default: return '#94a3b8';
    }
  };

  const getSessionStateText = (state: string) => {
    switch (state) {
      case 'focusing': return '专注中';
      case 'resting': return '休息中';
      default: return '空闲';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.surfaceLowest,
          borderRadius: 16,
          padding: 24,
          maxWidth: 500,
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.onSurface, margin: 0 }}>自习室</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: C.onSurfaceVariant,
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2',
            color: C.error,
            padding: '8px 12px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13
          }}>
            {error}
          </div>
        )}

        {!room ? (
          <>
            {/* Entry Mode Selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[
                { mode: 'self' as EntryMode, label: '自己自习', icon: '👤' },
                { mode: 'friend' as EntryMode, label: '加入好友', icon: '👥' },
                { mode: 'room' as EntryMode, label: '房间号加入', icon: '🔢' },
              ].map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  onClick={() => setEntryMode(mode)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: 10,
                    border: `1px solid ${entryMode === mode ? C.primary : C.outlineVariant}`,
                    background: entryMode === mode ? `${C.primary}10` : 'transparent',
                    color: entryMode === mode ? C.primary : C.onSurfaceVariant,
                    fontSize: 12,
                    fontWeight: entryMode === mode ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div>{icon}</div>
                  <div style={{ marginTop: 4 }}>{label}</div>
                </button>
              ))}
            </div>

            {/* Self Study Mode */}
            {entryMode === 'self' && (
              <div>
                <p style={{ fontSize: 12, color: C.onSurfaceVariant, marginBottom: 12 }}>选择本次专注时长</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[25, 45, 60].map((minute) => (
                    <button
                      key={minute}
                      onClick={() => setSelectedDuration(minute)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 20,
                        border: `1px solid ${selectedDuration === minute ? C.primary : C.outlineVariant}`,
                        background: selectedDuration === minute ? `${C.primary}10` : 'transparent',
                        color: selectedDuration === minute ? C.primary : C.onSurfaceVariant,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      {minute} 分钟
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleStartSelfStudy}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    border: 'none',
                    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryContainer})`,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ▶ 开始自己自习
                </button>
              </div>
            )}

            {/* Room Code Mode */}
            {entryMode === 'room' && (
              <div>
                <p style={{ fontSize: 12, color: C.onSurfaceVariant, marginBottom: 12 }}>输入房间号加入，或创建新房间</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="输入房间号"
                    maxLength={8}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${C.outlineVariant}`,
                      background: C.surfaceLow,
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleCreateRoom}
                    disabled={isBusy}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#06b6d4',
                      color: '#fff',
                      fontSize: 13,
                      cursor: 'pointer',
                      opacity: isBusy ? 0.6 : 1,
                    }}
                  >
                    创建
                  </button>
                  <button
                    onClick={handleJoinRoom}
                    disabled={isBusy || !roomCodeInput}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: C.primary,
                      color: '#fff',
                      fontSize: 13,
                      cursor: 'pointer',
                      opacity: (isBusy || !roomCodeInput) ? 0.6 : 1,
                    }}
                  >
                    加入
                  </button>
                </div>
              </div>
            )}

            {/* Friend Mode (placeholder) */}
            {entryMode === 'friend' && (
              <div style={{ textAlign: 'center', padding: 20, color: C.onSurfaceVariant }}>
                <div style={{
                  display: 'inline-block',
                  background: C.primaryContainer,
                  color: C.onPrimaryContainer,
                  borderRadius: 12,
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  即将推出
                </div>
                <p>好友列表功能开发中...</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Room Info */}
            <div style={{
              background: C.surfaceLow,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Room</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: C.onSurface }}>{room.roomCode}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Session</div>
                  <div style={{ fontSize: 14, color: C.onSurface }}>{getSessionStateText(room.sessionState)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Members</div>
                  <div style={{ fontSize: 14, color: C.onSurface }}>{room.members.length} / {room.maxMembers}</div>
                </div>
              </div>

              {/* Timer */}
              {room.timer && room.sessionState !== 'idle' && (
                <div style={{
                  background: C.surfaceLowest,
                  borderRadius: 10,
                  padding: 12,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 11, color: C.onSurfaceVariant, marginBottom: 4 }}>Remaining</div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'monospace', color: C.onSurface }}>
                    {formatTime(Math.max(0, Math.floor((room.timer.endsAt - Date.now()) / 1000)))}
                  </div>
                </div>
              )}
            </div>

            {/* Members */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.onSurface, marginBottom: 8 }}>参与者</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 }}>
                {room.members.map((member) => (
                  <div
                    key={member.userId}
                    style={{
                      background: C.surfaceLow,
                      borderRadius: 10,
                      padding: 10,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: `${C.primary}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 6px',
                      fontSize: 16,
                      fontWeight: 600,
                      color: C.primary,
                    }}>
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ fontSize: 12, color: C.onSurface, fontWeight: 500, marginBottom: 2 }}>
                      {member.displayName}
                      {member.userId === room.hostUserId && ' 👑'}
                    </div>
                    <div style={{ fontSize: 10, color: getStatusColor(member.status) }}>
                      {member.status}
                    </div>
                  </div>
                ))}
                {Array.from({ length: room.maxMembers - room.members.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    style={{
                      background: C.surfaceLow,
                      borderRadius: 10,
                      padding: 10,
                      textAlign: 'center',
                      border: `1px dashed ${C.outlineVariant}`,
                    }}
                  >
                    <div style={{ fontSize: 12, color: C.onSurfaceVariant, opacity: 0.5 }}>空位</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Host Controls */}
            {isHost && (
              <div style={{ marginBottom: 16 }}>
                {room.sessionState === 'idle' && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: C.onSurfaceVariant, marginBottom: 8 }}>Focus Duration</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[25, 45, 60].map((minute) => (
                        <button
                          key={minute}
                          onClick={() => setSelectedDuration(minute)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 16,
                            border: `1px solid ${selectedDuration === minute ? C.primary : C.outlineVariant}`,
                            background: selectedDuration === minute ? `${C.primary}10` : 'transparent',
                            color: selectedDuration === minute ? C.primary : C.onSurfaceVariant,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {minute} 分钟
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleHostAction('start_focus')}
                    disabled={isBusy || room.sessionState !== 'idle'}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#16a34a',
                      color: '#fff',
                      fontSize: 13,
                      cursor: 'pointer',
                      opacity: (isBusy || room.sessionState !== 'idle') ? 0.5 : 1,
                    }}
                  >
                    ▶ 开始
                  </button>
                  <button
                    onClick={() => handleHostAction('pause')}
                    disabled={isBusy || room.sessionState !== 'focusing'}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#f59e0b',
                      color: '#fff',
                      fontSize: 13,
                      cursor: 'pointer',
                      opacity: (isBusy || room.sessionState !== 'focusing') ? 0.5 : 1,
                    }}
                  >
                    ⏸ 暂停
                  </button>
                  <button
                    onClick={() => handleHostAction('end')}
                    disabled={isBusy || room.sessionState === 'idle'}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#64748b',
                      color: '#fff',
                      fontSize: 13,
                      cursor: 'pointer',
                      opacity: (isBusy || room.sessionState === 'idle') ? 0.5 : 1,
                    }}
                  >
                    ⬛ 结束
                  </button>
                </div>
              </div>
            )}

            {/* Leave Room */}
            <button
              onClick={handleLeaveRoom}
              disabled={isBusy}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 10,
                border: 'none',
                background: '#ef4444',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              🚪 离开房间
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Main StudyPage Component ─────────────────────────────────────────────────

interface StudyStats {
  todayMinutes: number;
  weekMinutes: number;
  totalMinutes: number;
  sessionCount: number;
}

export default function StudyPage() {
  const api = window.electronAPI;
  const [activeTab, setActiveTab] = useState<'focus' | 'courses' | 'stats'>('focus');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [studyStats, setStudyStats] = useState<StudyStats>({
    todayMinutes: 0,
    weekMinutes: 0,
    totalMinutes: 0,
    sessionCount: 0
  });
  const [isStudyRoomOpen, setIsStudyRoomOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ id: string; displayName: string; avatarUrl?: string }>({
    id: '',
    displayName: 'TRIX 用户'
  });
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [systemMetricsLoading, setSystemMetricsLoading] = useState(true);

  // Load system metrics (CPU/memory from OS + gateway latency from health check)
  useEffect(() => {
    if (!api?.getSystemInfo || !api?.gatewayHealth) {
      setSystemMetricsLoading(false);
      return;
    }
    const load = async () => {
      setSystemMetricsLoading(true);
      try {
        const [sysResult, gwResult] = await Promise.all([
          api.getSystemInfo(),
          api.gatewayHealth(),
        ]);
        const metrics: SystemMetrics = {
          cpu: { usage: sysResult.success && sysResult.data ? sysResult.data.cpu.usage : 0 },
          memory: sysResult.success && sysResult.data ? {
            used: sysResult.data.memory.used,
            total: sysResult.data.memory.total,
            usage: sysResult.data.memory.usage,
          } : { used: 0, total: 0, usage: 0 },
          gateway: {
            latencyMs: gwResult.success && gwResult.data ? (gwResult.data.layers.http.latencyMs ?? 0) : undefined,
            status: gwResult.success && gwResult.data ? gwResult.data.status : 'down',
          },
        };
        setSystemMetrics(metrics);
      } catch {
        setSystemMetrics(null);
      } finally {
        setSystemMetricsLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [api]);

  // Load user profile
  useEffect(() => {
    if (!api?.getProfileStats) return;
    api.getProfileStats().then((result) => {
      if (result.success && result.data) {
        setUserProfile({
          id: result.data.displayName,
          displayName: result.data.displayName,
        });
      }
    }).catch(() => {});
  }, [api]);

  const loadTodos = useCallback(async () => {
    if (!api?.listTodos) {
      setTodos([]);
      return;
    }

    try {
      const result = await api.listTodos();
      if (result.success && Array.isArray(result.data) && result.data.length > 0) {
        setTodos(result.data.map((t) => {
          const raw = t as { id: string; text?: string; title?: string; completed: boolean; priority?: string; deadline?: string };
          const priority = raw.priority as 'high' | 'medium' | 'low';
          return {
            id: raw.id,
            text: raw.text ?? raw.title ?? '',
            completed: raw.completed,
            priority: (priority === 'high' || priority === 'medium' || priority === 'low') ? priority : 'medium',
            deadline: raw.deadline,
          };
        }));
        return;
      }

      setTodos([]);
    } catch {
      setTodos([]);
    }
  }, [api]);

  // Load todos from IPC (Supabase via main process)
  useEffect(() => {
    void loadTodos();
  }, [loadTodos]);

  // Load study stats from IPC (Supabase via main process)
  useEffect(() => {
    if (!api?.getStudyStats) return;
    const loadStats = () => {
      api.getStudyStats().then((result) => {
        if (result.success && result.data) {
          setStudyStats(result.data);
        }
      }).catch(() => {});
    };
    loadStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [api]);

  const toggleTodo = useCallback((id: string) => {
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t)
    );
    // Persist via API (fire-and-forget, graceful failure)
    if (api?.toggleTodo) {
      const todo = todos.find((t) => t.id === id);
      if (todo) {
        api.toggleTodo(id, !todo.completed).catch(() => {});
      }
    }
  }, [api, todos]);

  const handleCreateTodo = useCallback(async () => {
    if (!api?.createTodo) return;

    const title = window.prompt('输入一个新的待办事项');
    const trimmedTitle = title?.trim();
    if (!trimmedTitle) return;

    try {
      const result = await api.createTodo(trimmedTitle, 'medium');
      if (result.success) {
        await loadTodos();
      }
    } catch {
      // Ignore prompt-driven create failures and keep the current list intact.
    }
  }, [api, loadTodos]);

  // Format minutes to hours and minutes
  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

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
            <button
              onClick={() => setIsStudyRoomOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                background: `${C.primary}10`,
                border: `1px solid ${C.primary}20`,
                cursor: 'pointer',
                fontSize: 11,
                color: C.primary,
                fontWeight: 600,
              }}
            >
              🏠 自习室
            </button>
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

        <LuminaTabBar tabs={tabs} activeTab={activeTab} onChange={(key: string) => setActiveTab(key as typeof activeTab)} />
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
          {/* Focus tab content */}
          {activeTab === 'focus' && (
          <>
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
                  {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
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
                {(studyStats.todayMinutes / 60).toFixed(1)}
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
              value={studyStats.todayMinutes / 60}
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
              value={formatMinutes(studyStats.todayMinutes)}
              sub={`共 ${studyStats.sessionCount} 次`}
              color={C.primary}
              colorBg={`${C.primary}10`}
            />
            <StatCard
              icon={<CheckCircle size={16} />}
              label="本周专注时长"
              value={formatMinutes(studyStats.weekMinutes)}
              sub="累计"
              color="#16a34a"
              colorBg="#16a34a10"
            />
          </div>

          {/* Study Overview */}
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
              学习概览
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: '今日时长', value: formatMinutes(studyStats.todayMinutes), color: C.primary },
                { label: '本周时长', value: formatMinutes(studyStats.weekMinutes), color: '#16a34a' },
                { label: '会话数', value: `${studyStats.sessionCount} 个`, color: '#0369a1' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: 10,
                    background: `${item.color}10`,
                    border: `1px solid ${item.color}25`,
                    cursor: 'default',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: C.onSurfaceVariant,
                      fontWeight: 600,
                      textAlign: 'center',
                      lineHeight: 1.3,
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      color: item.color,
                      fontWeight: 600,
                      textAlign: 'center',
                      lineHeight: 1.3,
                    }}
                  >
                    {item.value}
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
              {todos.length === 0 && (
                <div
                  style={{
                    padding: '12px 10px',
                    borderRadius: 8,
                    background: C.surfaceLow,
                    fontSize: 12,
                    color: C.onSurfaceVariant,
                  }}
                >
                  暂无真实待办数据
                </div>
              )}
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
              onClick={() => { void handleCreateTodo(); }}
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
          </>
          )}
          {activeTab === 'courses' && <CoursesTabContent />}
          {activeTab === 'stats' && <StatsTabContent studyStats={studyStats} loading={false} />}
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
          <AIHeartbeat metrics={systemMetrics} loading={systemMetricsLoading} />
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
              <QuickStat label="专注总时长" value={formatMinutes(studyStats.weekMinutes)} icon={<Clock size={12} />} />
              <QuickStat label="完成番茄钟" value={`${studyStats.sessionCount} 个`} icon={<CheckCircle size={12} />} />
              <QuickStat label="累计学习" value={formatMinutes(studyStats.totalMinutes)} icon={<Activity size={12} />} />
            </div>
          </div>
        </div>
      </div>

      {/* Study Room Modal */}
      <StudyRoom
        isOpen={isStudyRoomOpen}
        onClose={() => setIsStudyRoomOpen(false)}
        currentUserId={userProfile.id}
        displayName={userProfile.displayName}
        avatarUrl={userProfile.avatarUrl}
      />

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
