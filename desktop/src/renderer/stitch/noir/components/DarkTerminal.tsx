import React, { useRef, useEffect } from 'react';
import { cn } from '../../shared/cn';

export interface LogEntry {
  id: number;
  type: 'info' | 'success' | 'error' | 'warning' | 'command' | 'output';
  text: string;
  timestamp?: string;
}

interface DarkTerminalProps {
  entries?: LogEntry[];
  className?: string;
  style?: React.CSSProperties;
  /** Max entries to keep in view */
  maxEntries?: number;
  autoScroll?: boolean;
}

/** Default colors by log type */
const typeColors: Record<LogEntry['type'], string> = {
  info: '#919191',
  success: '#4ade80',
  error: '#ff6b6b',
  warning: '#fbbf24',
  command: '#d2bbff',
  output: '#c6c6c6',
};

export const DarkTerminal = ({
  entries = [],
  className,
  style,
  maxEntries = 500,
  autoScroll = true,
}: DarkTerminalProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const displayEntries = entries.slice(-maxEntries);

  return (
    <div
      className={cn('dark-terminal', className)}
      style={{
        background: '#0e0e0e',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: '12px 0',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 12,
        lineHeight: 1.6,
        ...style,
      }}
    >
      {/* Terminal header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 12px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          flexShrink: 0,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
        <span
          style={{
            marginLeft: 8,
            fontSize: 10,
            color: '#474747',
            letterSpacing: '0.05em',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          openclaw — bash
        </span>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
        }}
      >
        {displayEntries.length === 0 && (
          <span style={{ color: '#474747', fontStyle: 'italic' }}>
            等待输出...
          </span>
        )}
        {displayEntries.map((entry) => (
          <div
            key={entry.id}
            style={{
              color: typeColors[entry.type],
              display: 'flex',
              gap: 8,
              marginBottom: 2,
              wordBreak: 'break-word',
            }}
          >
            {entry.timestamp && (
              <span style={{ color: '#474747', flexShrink: 0 }}>{entry.timestamp}</span>
            )}
            <span>{entry.text}</span>
          </div>
        ))}
      </div>

      <style>{`
        .dark-terminal::-webkit-scrollbar { width: 4px; }
        .dark-terminal::-webkit-scrollbar-track { background: transparent; }
        .dark-terminal::-webkit-scrollbar-thumb { background: #353534; border-radius: 10px; }
        .dark-terminal::-webkit-scrollbar-thumb:hover { background: #474747; }
      `}</style>
    </div>
  );
};

// Utility to create log entries
let _logId = 0;
export const createLogEntry = (
  type: LogEntry['type'],
  text: string,
  timestamp?: string
): LogEntry => ({
  id: ++_logId,
  type,
  text,
  timestamp: timestamp ?? new Date().toLocaleTimeString('zh-CN', { hour12: false }),
});
