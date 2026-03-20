import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, Zap, Activity, Server, Clock, Cpu, HardDrive, RefreshCw, Play, Square, RotateCcw, Stethoscope, Terminal, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface GatewayStatus {
  running: boolean;
  port?: number;
  url?: string;
  error?: string;
}

interface OpenClawStatus {
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
}

interface AppInfo {
  version: string;
  electron: string;
  node: string;
  chrome: string;
  platform: string;
  isPackaged: boolean;
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

type StatusType = 'idle' | 'loading' | 'success' | 'error';

function StatusBadge({ running, label }: { running: boolean; label: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: running ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
        color: running ? '#22c55e' : '#ef4444',
        border: `1px solid ${running ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: running ? '#22c55e' : '#ef4444',
          animation: running ? 'pulse 2s infinite' : 'none',
        }}
      />
      {running ? '运行中' : '已停止'} · {label}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'secondary',
  disabled = false,
  loading = false,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const colors = {
    primary: { bg: '#6366f1', hover: '#4f46e5', text: '#fff' },
    secondary: { bg: 'rgba(255,255,255,0.06)', hover: 'rgba(255,255,255,0.1)', text: '#e2e8f0' },
    danger: { bg: 'rgba(239,68,68,0.12)', hover: 'rgba(239,68,68,0.2)', text: '#ef4444' },
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.08)',
        background: colors.bg,
        color: colors.text,
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        fontFamily: 'system-ui, sans-serif',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = colors.hover;
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.background = colors.bg;
      }}
    >
      {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Icon size={14} />}
      {label}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
}

function InfoCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'rgba(99,102,241,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} color="#818cf8" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
        <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function OpenClawDashboard() {
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [openClawStatus, setOpenClawStatus] = useState<OpenClawStatus | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logStatus, setLogStatus] = useState<StatusType>('idle');

  const loadStatus = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const [gw, oc, info] = await Promise.all([api.getGatewayStatus(), api.checkOpenClaw(), api.getAppInfo()]);
      setGatewayStatus(gw);
      setOpenClawStatus(oc);
      setAppInfo(info);
    } catch (err) {
      console.error('Failed to load status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const runCommand = async (cmd: string, label: string) => {
    const api = window.electronAPI;
    if (!api) return;
    setActionLoading((prev) => ({ ...prev, [cmd]: true }));
    setLogStatus('loading');
    const result: CommandResult = await api.runOpenClawCommand(cmd);
    const output = `[${label}]\n${result.stdout || result.stderr || result.error || '无输出'}`;
    setLogLines((prev) => [...prev.slice(-50), ...output.split('\n')]);
    setLogStatus(result.success ? 'success' : 'error');
    await loadStatus();
    setActionLoading((prev) => ({ ...prev, [cmd]: false }));
  };

  const handleRestart = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setActionLoading((prev) => ({ ...prev, restart: true }));
    setLogStatus('loading');
    setLogLines((prev) => [...prev.slice(-50), '[重启 Gateway] 正在重启...']);
    try {
      await api.restartGateway();
      setLogLines((prev) => [...prev.slice(-50), '[重启 Gateway] 成功重启!']);
      setLogStatus('success');
    } catch (err) {
      setLogLines((prev) => [...prev.slice(-50), `[重启 Gateway] 失败: ${String(err)}`]);
      setLogStatus('error');
    }
    await loadStatus();
    setActionLoading((prev) => ({ ...prev, restart: false }));
  };

  const handleDoctor = async () => {
    await runCommand('doctor', '健康检查');
  };

  const handleStatus = async () => {
    await runCommand('status', '状态');
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={24} color="#6366f1" style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
          <p style={{ color: '#64748b', fontSize: 13, fontFamily: 'system-ui' }}>加载中...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: 24,
        background: 'var(--bg-primary)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>OpenClaw 控制台</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            管理 Gateway、AI Agent 与消息渠道
          </p>
        </div>
        <ActionButton icon={RefreshCw} label="刷新状态" onClick={loadStatus} variant="secondary" />
      </div>

      {/* Status Banner */}
      <div
        style={{
          background: gatewayStatus?.running
            ? 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.03))'
            : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.03))',
          border: `1px solid ${gatewayStatus?.running ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          borderRadius: 16,
          padding: '20px 24px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: gatewayStatus?.running ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Zap size={24} color={gatewayStatus?.running ? '#22c55e' : '#ef4444'} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
            {gatewayStatus?.running ? 'Gateway 运行中' : 'Gateway 未运行'}
          </div>
          {gatewayStatus?.running ? (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              端口 {gatewayStatus.port} · {gatewayStatus.url}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {openClawStatus?.installed
                ? 'Gateway 未启动，请点击右侧「启动」按钮'
                : 'OpenClaw 未安装，请在下方安装'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {openClawStatus?.installed && (
            <>
              {gatewayStatus?.running ? (
                <ActionButton icon={Square} label="停止" onClick={handleRestart} variant="danger" loading={!!actionLoading.restart} />
              ) : (
                <ActionButton icon={Play} label="启动" onClick={handleRestart} variant="primary" loading={!!actionLoading.restart} />
              )}
            </>
          )}
          <ActionButton icon={Stethoscope} label="诊断" onClick={handleDoctor} variant="secondary" loading={!!actionLoading.doctor} />
          <ActionButton icon={Activity} label="状态" onClick={handleStatus} variant="secondary" loading={!!actionLoading.status} />
        </div>
      </div>

      {/* Info Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
        <InfoCard icon={Server} label="Gateway 端口" value={String(gatewayStatus?.port ?? '—')} sub="WebSocket 通信端口" />
        <InfoCard icon={Bot} label="OpenClaw 版本" value={openClawStatus?.version ?? '未安装'} sub={openClawStatus?.installed ? '已安装' : '运行安装以使用'} />
        <InfoCard icon={Cpu} label="Node.js" value={appInfo?.node ?? '—'} sub="Electron 运行环境" />
        <InfoCard icon={HardDrive} label="Electron" value={appInfo?.electron ?? '—'} sub={appInfo?.isPackaged ? '生产环境' : '开发模式'} />
      </div>

      {/* Gateway URL */}
      {gatewayStatus?.running && (
        <div
          style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Server size={16} color="#818cf8" />
          <span style={{ fontSize: 13, color: '#818cf8', flex: 1, fontFamily: 'ui-monospace, monospace' }}>{gatewayStatus.url}</span>
          <button
            onClick={() => navigator.clipboard.writeText(gatewayStatus.url ?? '')}
            style={{ padding: '4px 10px', background: 'rgba(99,102,241,0.15)', border: 'none', borderRadius: 6, color: '#818cf8', fontSize: 12, cursor: 'pointer' }}
          >
            复制
          </button>
        </div>
      )}

      {/* Log Panel */}
      <div
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Terminal size={14} color="#64748b" />
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>输出日志</span>
          {logStatus !== 'idle' && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: logStatus === 'success' ? '#22c55e' : logStatus === 'loading' ? '#f59e0b' : '#ef4444',
                marginLeft: 'auto',
              }}
            />
          )}
        </div>
        <div
          style={{
            padding: '12px 16px',
            maxHeight: 280,
            overflowY: 'auto',
            fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {logLines.length === 0 ? (
            <div style={{ color: '#334155', fontStyle: 'italic' }}>暂无日志输出。点击上方「诊断」或「状态」按钮查看。</div>
          ) : (
            logLines.map((line, i) => (
              <div
                key={i}
                style={{
                  color: line.startsWith('[重启') || line.startsWith('[健康')
                    ? '#f59e0b'
                    : line.includes('失败') || line.includes('错误') || line.includes('Error')
                    ? '#ef4444'
                    : line.includes('成功') || line.includes('✓')
                    ? '#22c55e'
                    : '#94a3b8',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {line || ' '}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
