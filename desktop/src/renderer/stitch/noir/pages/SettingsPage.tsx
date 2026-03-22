import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, Zap, FolderOpen, Link, Server,
  Info, CheckCircle, XCircle, RefreshCw,
  LogIn, LogOut, User, Shield, Eye, EyeOff,
  Play, Square, Trash2, Clock, KeyRound,
} from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import { DarkTerminal, createLogEntry, type LogEntry } from '../components/DarkTerminal';

interface OpenClawStatus {
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
}

interface GatewayStatus {
  running: boolean;
  port?: number;
  pid?: number;
  url?: string;
  error?: string;
}

interface PairingCode {
  code: string;
  createdAt: string;
  expiresAt: string;
  claimed: boolean;
  qrDataUrl?: string;
}

interface AppInfo {
  version: string;
  name: string;
  electron: string;
  node: string;
  chrome: string;
  platform: string;
  userData: string;
  isPackaged: boolean;
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

type Tab = 'overview' | 'agents' | 'skills' | 'backups' | 'pairing' | 'gateway' | 'account';

const TAB_LABELS: Record<Tab, { label: string; icon: React.ElementType }> = {
  overview: { label: '概览', icon: Info },
  agents: { label: 'Agents', icon: Bot },
  skills: { label: 'Skills', icon: Zap },
  backups: { label: '备份', icon: FolderOpen },
  pairing: { label: '配对码', icon: Link },
  gateway: { label: 'Gateway', icon: Server },
  account: { label: '账户', icon: User },
};

const StatusBadge = ({
  installed,
  label,
}: {
  installed: boolean;
  label: string;
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: installed ? 'rgba(74,222,128,0.1)' : 'rgba(255,107,107,0.1)',
      color: installed ? '#4ade80' : '#ff6b6b',
      border: `1px solid ${installed ? 'rgba(74,222,128,0.2)' : 'rgba(255,107,107,0.2)'}`,
    }}
  >
    {installed ? <CheckCircle size={12} /> : <XCircle size={12} />}
    {label}
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '7px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      gap: 16,
    }}
  >
    <span style={{ fontSize: 12, color: '#919191', flexShrink: 0 }}>{label}</span>
    <span
      style={{
        fontSize: value.includes('/') ? 11 : 12,
        color: '#e5e2e1',
        textAlign: 'right',
        wordBreak: 'break-all',
        fontFamily: value.includes('/') ? "'JetBrains Mono', monospace" : 'system-ui',
      }}
    >
      {value}
    </span>
  </div>
);

const TabButton = ({
  tab,
  active,
  onClick,
}: {
  tab: Tab;
  active: boolean;
  onClick: () => void;
}) => {
  const cfg = TAB_LABELS[tab];
  const Icon = cfg.icon as React.ComponentType<{ size?: number }>;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 8,
        border: 'none',
        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: active ? '#e5e2e1' : '#919191',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'system-ui, sans-serif',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <Icon size={14} />
      {cfg.label}
    </button>
  );
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [openClawStatus, setOpenClawStatus] = useState<OpenClawStatus | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [installProgress, setInstallProgress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [runningCommand, setRunningCommand] = useState(false);
  const [gatewayLogLines, setGatewayLogLines] = useState<string[]>([]);
  const [pairingCodes, setPairingCodes] = useState<PairingCode[]>([]);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingSuccess, setPairingSuccess] = useState<string | null>(null);
  const [revokingCode, setRevokingCode] = useState<string | null>(null);
  const [generatedQr, setGeneratedQr] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  // ── Auth state ────────────────────────────────────────────────────────────
  const [session, setSession] = useState<{ user?: { email?: string }; access_token?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const addLog = (entry: LogEntry) =>
    setLogEntries((prev) => [...prev.slice(-99), entry]);

  const loadStatus = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    try {
      const [openclaw, gateway, info] = await Promise.all([
        api.checkOpenClaw(),
        api.getGatewayStatus(),
        api.getAppInfo(),
      ]);
      setOpenClawStatus(openclaw);
      setGatewayStatus(gateway);
      setAppInfo(info);
    } catch (err) {
      addLog(createLogEntry('error', `状态加载失败: ${String(err)}`));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGatewayLogs = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    try {
      const result = await api.gatewayLogs({ lines: 150 });
      if (result.success && result.data) {
        setGatewayLogLines(result.data);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadPairingCodes = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setPairingLoading(true);
    setPairingError(null);
    try {
      const result = await api.pairingList();
      if (result.success && result.data) {
        setPairingCodes(result.data);
      } else {
        setPairingError(result.error ?? '加载失败');
        setPairingCodes([]);
      }
    } catch (err) {
      setPairingError(String(err));
    } finally {
      setPairingLoading(false);
    }
  }, []);

  const loadAuthSession = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    api.authGetSession().then((result) => {
      if (result.success && result.data) {
        setSession(result.data as { user?: { email?: string }; access_token?: string });
      }
    }).catch(() => {});
  }, []);

  // Load auth session on mount
  useEffect(() => {
    loadAuthSession();
  }, [loadAuthSession]);

  // Load gateway logs when gateway tab is active
  useEffect(() => {
    if (activeTab === 'gateway') {
      loadGatewayLogs();
    }
  }, [activeTab, gatewayStatus, loadGatewayLogs]);

  // Load pairing codes when pairing tab is active
  useEffect(() => {
    if (activeTab === 'pairing') {
      loadPairingCodes();
    }
  }, [activeTab, loadPairingCodes]);

  // ── Auth handlers ─────────────────────────────────────────────────────────

  const handleAuthSubmit = async () => {
    if (!authEmail.trim() || !authPassword) return;
    const api = window.electronAPI;
    if (!api) return;

    setAuthLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      if (authMode === 'signin') {
        const result = await api.authSignIn(authEmail.trim(), authPassword);
        if (result.success && result.data) {
          setSession(result.data as { user?: { email?: string }; access_token?: string });
          setAuthSuccess('登录成功');
          setAuthEmail('');
          setAuthPassword('');
        } else {
          setAuthError(result.error || '登录失败');
        }
      } else {
        const result = await api.authSignUp(authEmail.trim(), authPassword);
        if (result.success) {
          setAuthSuccess('注册成功，请查收确认邮件');
          setAuthMode('signin');
        } else {
          setAuthError(result.error || '注册失败');
        }
      }
    } catch (err) {
      setAuthError(String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    const api = window.electronAPI;
    if (!api) return;
    await api.authSignOut();
    setSession(null);
    setAuthSuccess(null);
  };

  useEffect(() => {
    loadStatus();
    const api = window.electronAPI;
    if (!api) return;
    const unsubProgress = api.onInstallProgress?.((msg) => {
      setInstallProgress(msg);
      addLog(createLogEntry('info', msg));
    });
    return () => { unsubProgress?.(); };
  }, [loadStatus]);

  const runCommand = async (cmd: string, label: string) => {
    const api = window.electronAPI;
    if (!api) return;
    setRunningCommand(true);
    addLog(createLogEntry('command', `$ ${cmd}`));
    try {
      const result: CommandResult = await api.runOpenClawCommand(cmd);
      const output = result.stdout || result.stderr || result.error || '无输出';
      output.split('\n').forEach((line) => {
        if (line.trim()) addLog(createLogEntry(result.success ? 'output' : 'error', line));
      });
      addLog(createLogEntry(result.success ? 'success' : 'error', `${label} ${result.success ? '成功' : '失败'}`));
    } catch (err) {
      addLog(createLogEntry('error', `执行失败: ${String(err)}`));
    }
    setRunningCommand(false);
  };

  const handleInstallOpenClaw = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setInstallProgress('正在初始化安装...');
    setRunningCommand(true);
    try {
      const result = await api.installOpenClaw();
      if (result.success) {
        setInstallProgress('安装完成！');
        addLog(createLogEntry('success', 'OpenClaw 安装成功'));
        await loadStatus();
      } else {
        setInstallProgress(`安装失败: ${result.error}`);
        addLog(createLogEntry('error', `安装失败: ${result.error}`));
      }
    } finally {
      setRunningCommand(false);
    }
  };

  const handleStartGateway = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setRunningCommand(true);
    addLog(createLogEntry('warning', '正在启动 Gateway...'));
    try {
      const result = await api.gatewayStart();
      if (result.success) {
        addLog(createLogEntry('success', `Gateway 已启动 (端口 ${result.data?.port})`));
        await loadStatus();
        await loadGatewayLogs();
      } else {
        addLog(createLogEntry('error', `启动失败: ${result.error}`));
      }
    } finally {
      setRunningCommand(false);
    }
  };

  const handleStopGateway = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setRunningCommand(true);
    addLog(createLogEntry('warning', '正在停止 Gateway...'));
    try {
      const result = await api.gatewayStop();
      if (result.success) {
        addLog(createLogEntry('success', 'Gateway 已停止'));
        await loadStatus();
        await loadGatewayLogs();
      } else {
        addLog(createLogEntry('error', `停止失败: ${result.error}`));
      }
    } finally {
      setRunningCommand(false);
    }
  };

  const handleRestartGateway = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setRunningCommand(true);
    addLog(createLogEntry('warning', '正在重启 Gateway...'));
    try {
      const result = await api.restartGateway();
      if (result.success) {
        addLog(createLogEntry('success', `Gateway 重启成功 (端口 ${result.data?.port})`));
        await loadStatus();
        await loadGatewayLogs();
      } else {
        addLog(createLogEntry('error', `重启失败: ${result.error}`));
      }
    } finally {
      setRunningCommand(false);
    }
  };

  const handleGeneratePairing = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setGeneratingCode(true);
    setPairingError(null);
    setPairingSuccess(null);
    setGeneratedQr(null);
    try {
      const result = await api.pairingGenerate();
      if (result.success && result.data) {
        setPairingSuccess(`配对码已生成: ${result.data.code.slice(0, 3)}***`);
        setGeneratedQr(result.data.qrDataUrl ?? null);
        await loadPairingCodes();
      } else {
        setPairingError(result.error ?? '生成失败');
      }
    } catch (err) {
      setPairingError(String(err));
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleRevokePairing = async (code: string) => {
    const api = window.electronAPI;
    if (!api) return;
    setRevokingCode(code);
    setPairingError(null);
    setPairingSuccess(null);
    try {
      const result = await api.pairingRevoke(code);
      if (result.success) {
        setPairingSuccess(`配对码 ${code.slice(0, 3)}*** 已撤销`);
        await loadPairingCodes();
      } else {
        setPairingError(result.error ?? '撤销失败');
      }
    } catch (err) {
      setPairingError(String(err));
    } finally {
      setRevokingCode(null);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#131313',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid rgba(255,255,255,0.1)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: '#919191', fontSize: 13 }}>加载设置...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: '#131313',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 28px 0',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e5e2e1', margin: 0 }}>
              桌面设置
            </h1>
            <p style={{ fontSize: 12, color: '#919191', margin: '4px 0 0' }}>
              TRIX Companion Windows 桌面版
            </p>
          </div>
          <DarkButton
            icon={<RefreshCw size={13} />}
            label="刷新"
            onClick={loadStatus}
            variant="outline"
            size="md"
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <TabButton
              key={tab}
              tab={tab}
              active={activeTab === tab}
              onClick={() => setActiveTab(tab)}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 28px 28px' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
            {/* App Info */}
            {appInfo && (
              <DarkCard elevation="low">
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
                    应用程序
                  </div>
                  <div>
                    <InfoRow label="版本" value={appInfo.version} />
                    <InfoRow label="Electron" value={appInfo.electron} />
                    <InfoRow label="Node.js" value={appInfo.node} />
                    <InfoRow label="Chrome" value={appInfo.chrome} />
                    <InfoRow label="运行环境" value={appInfo.isPackaged ? '生产环境' : '开发模式'} />
                    <InfoRow label="数据目录" value={appInfo.userData} />
                  </div>
                </div>
              </DarkCard>
            )}

            {/* OpenClaw Status */}
            <DarkCard elevation="low">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>OpenClaw 状态</div>
                <StatusBadge installed={!!openClawStatus?.installed} label={openClawStatus?.installed ? '已安装' : '未安装'} />
              </div>
              {openClawStatus?.installed ? (
                <>
                  <InfoRow label="版本" value={openClawStatus.version || '未知'} />
                  <InfoRow label="路径" value={openClawStatus.path || 'PATH'} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <DarkButton label="运行诊断" onClick={() => runCommand('doctor', '诊断')} variant="outline" size="md" />
                    <DarkButton label="查看状态" onClick={() => runCommand('status', '状态')} variant="outline" size="md" />
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: '#919191', marginBottom: 14, lineHeight: 1.6 }}>
                    OpenClaw 是 TRIX Companion 的核心运行时，安装后可使用 AI Agent、Skill 管理和配对码等功能。
                  </p>
                  <DarkButton
                    label={runningCommand ? (installProgress || '安装中...') : '安装 OpenClaw'}
                    onClick={handleInstallOpenClaw}
                    variant="primary"
                    size="md"
                    disabled={runningCommand}
                    loading={runningCommand}
                  />
                  {installProgress && (
                    <p style={{ fontSize: 12, color: '#919191', marginTop: 8 }}>{installProgress}</p>
                  )}
                </>
              )}
            </DarkCard>

            {/* Gateway Status */}
            <DarkCard elevation="low">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>Gateway 状态</div>
                <StatusBadge installed={!!gatewayStatus?.running} label={gatewayStatus?.running ? '运行中' : '已停止'} />
              </div>
              {gatewayStatus?.running ? (
                <>
                  <InfoRow label="端口" value={String(gatewayStatus.port || 18789)} />
                  <InfoRow label="PID" value={gatewayStatus.pid ? String(gatewayStatus.pid) : '—'} />
                  <InfoRow label="地址" value={gatewayStatus.url || `ws://127.0.0.1:${gatewayStatus.port || 18789}`} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <DarkButton label="重启 Gateway" onClick={handleRestartGateway} variant="primary" size="md" />
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: '#919191', marginBottom: 14, lineHeight: 1.6 }}>
                    Gateway 负责 WebSocket 通信。启动 OpenClaw 后可以启动 Gateway。
                  </p>
                  {openClawStatus?.installed && (
                    <DarkButton label="启动 Gateway" onClick={handleStartGateway} variant="primary" size="md" disabled={runningCommand} />
                  )}
                </>
              )}
            </DarkCard>
          </div>
        )}

        {activeTab === 'agents' && (
          <div style={{ maxWidth: 720 }}>
            <DarkCard elevation="low">
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
                Agent 管理
              </div>
              <p style={{ fontSize: 12, color: '#919191', marginBottom: 14 }}>
                查看和切换 AI Agent/模型
              </p>
              <DarkButton
                label="列出 Agents"
                onClick={() => runCommand('agents list', 'Agent 列表')}
                variant="outline"
                size="md"
                disabled={runningCommand}
              />
            </DarkCard>
          </div>
        )}

        {activeTab === 'skills' && (
          <div style={{ maxWidth: 720 }}>
            <DarkCard elevation="low">
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
                Skill 管理
              </div>
              <p style={{ fontSize: 12, color: '#919191', marginBottom: 14 }}>
                安装和卸载 OpenClaw Skills
              </p>
              <DarkButton
                label="列出 Skills"
                onClick={() => runCommand('skills list', 'Skill 列表')}
                variant="outline"
                size="md"
                disabled={runningCommand}
              />
            </DarkCard>
          </div>
        )}

        {activeTab === 'backups' && (
          <div style={{ maxWidth: 720 }}>
            <DarkCard elevation="low">
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
                配置备份与回滚
              </div>
              <p style={{ fontSize: 12, color: '#919191', marginBottom: 14 }}>
                管理配置备份，恢复到之前的版本
              </p>
              <DarkButton
                label="列出备份"
                onClick={() => runCommand('backup list', '备份列表')}
                variant="outline"
                size="md"
                disabled={runningCommand}
              />
            </DarkCard>
          </div>
        )}

        {activeTab === 'pairing' && (
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Generate new code */}
            <DarkCard elevation="low">
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
                生成新配对码
              </div>
              <p style={{ fontSize: 12, color: '#919191', marginBottom: 14, lineHeight: 1.6 }}>
                连接 TRIX Native 设备（手机/平板）到桌面端。配对码有效期 30 分钟。
              </p>
              {pairingError && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
                  color: '#ff6b6b', fontSize: 12, marginBottom: 12,
                }}>
                  {pairingError}
                </div>
              )}
              {pairingSuccess && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)',
                  color: '#4ade80', fontSize: 12, marginBottom: 12,
                }}>
                  {pairingSuccess}
                </div>
              )}
              {generatedQr && (
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                  <img
                    src={generatedQr}
                    alt="Pairing QR Code"
                    style={{ width: 160, height: 160, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <p style={{ fontSize: 11, color: '#919191', marginTop: 8 }}>
                    有效期 30 分钟，请尽快扫码
                  </p>
                </div>
              )}
              <DarkButton
                icon={<KeyRound size={13} />}
                label={generatingCode ? '生成中...' : '生成配对码'}
                onClick={handleGeneratePairing}
                variant="primary"
                size="md"
                disabled={generatingCode}
                loading={generatingCode}
              />
            </DarkCard>

            {/* Active codes list */}
            <DarkCard elevation="low">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>
                  配对码列表
                </div>
                <DarkButton
                  icon={<RefreshCw size={12} />}
                  label="刷新"
                  onClick={loadPairingCodes}
                  variant="outline"
                  size="sm"
                  disabled={pairingLoading}
                />
              </div>

              {pairingLoading ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ color: '#919191', fontSize: 12 }}>加载中...</div>
                </div>
              ) : pairingCodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#919191', fontSize: 12 }}>
                  暂无配对码
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pairingCodes.map((pc) => {
                    const expiryMs = pc.expiresAt ? new Date(pc.expiresAt).getTime() - Date.now() : 0;
                    const isExpired = expiryMs <= 0;
                    const mins = Math.floor(Math.max(0, expiryMs) / 60000);
                    const secs = Math.floor((Math.max(0, expiryMs) % 60000) / 1000);
                    const timeLeft = isExpired ? '已过期' : `${mins}m ${secs}s`;
                    return (
                      <div
                        key={pc.code}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <code style={{
                              fontSize: 13,
                              fontFamily: "'JetBrains Mono', monospace",
                              color: '#e5e2e1',
                              letterSpacing: '0.05em',
                            }}>
                              {pc.code.slice(0, 3)}***
                            </code>
                            <span style={{
                              padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                              background: pc.claimed
                                ? 'rgba(74,222,128,0.1)'
                                : isExpired
                                ? 'rgba(255,107,107,0.1)'
                                : 'rgba(99,14,212,0.15)',
                              color: pc.claimed ? '#4ade80' : isExpired ? '#ff6b6b' : '#a78bfa',
                              border: `1px solid ${pc.claimed ? 'rgba(74,222,128,0.2)' : isExpired ? 'rgba(255,107,107,0.2)' : 'rgba(99,14,212,0.3)'}`,
                            }}>
                              {pc.claimed ? '已使用' : isExpired ? '已过期' : '活跃'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#919191' }}>
                            <Clock size={11} />
                            {isExpired ? '已过期' : `剩余 ${timeLeft}`}
                          </div>
                        </div>
                        {!pc.claimed && !isExpired && (
                          <DarkButton
                            icon={<Trash2 size={12} />}
                            label="撤销"
                            onClick={() => handleRevokePairing(pc.code)}
                            variant="outline"
                            size="sm"
                            disabled={revokingCode === pc.code}
                            loading={revokingCode === pc.code}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </DarkCard>
          </div>
        )}

        {activeTab === 'gateway' && (
          <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Status card */}
            <DarkCard elevation="low">
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 14 }}>
                Gateway 状态
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                {gatewayStatus ? (
                  <>
                    <InfoRow label="状态" value={gatewayStatus.running ? '运行中' : '已停止'} />
                    <InfoRow label="端口" value={String(gatewayStatus.port || 18789)} />
                    {gatewayStatus.pid && <InfoRow label="PID" value={String(gatewayStatus.pid)} />}
                    <InfoRow label="地址" value={gatewayStatus.url || `ws://127.0.0.1:${gatewayStatus.port || 18789}`} />
                    {gatewayStatus.error && (
                      <div style={{
                        marginTop: 8, padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
                        color: '#ff6b6b', fontSize: 12,
                      }}>
                        错误: {gatewayStatus.error}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#919191', fontSize: 12 }}>加载中...</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {gatewayStatus?.running ? (
                  <>
                    <DarkButton
                      icon={<RefreshCw size={13} />}
                      label="重启"
                      onClick={handleRestartGateway}
                      variant="primary"
                      size="md"
                      disabled={runningCommand}
                      loading={runningCommand}
                    />
                    <DarkButton
                      icon={<Square size={13} />}
                      label="停止"
                      onClick={handleStopGateway}
                      variant="outline"
                      size="md"
                      disabled={runningCommand}
                      loading={runningCommand}
                    />
                  </>
                ) : (
                  <DarkButton
                    icon={<Play size={13} />}
                    label="启动"
                    onClick={handleStartGateway}
                    variant="primary"
                    size="md"
                    disabled={runningCommand || !openClawStatus?.installed}
                    loading={runningCommand}
                  />
                )}
                <DarkButton
                  icon={<RefreshCw size={13} />}
                  label="刷新日志"
                  onClick={loadGatewayLogs}
                  variant="outline"
                  size="md"
                />
              </div>
              {!openClawStatus?.installed && (
                <p style={{ fontSize: 11, color: '#919191', marginTop: 8 }}>
                  请先安装 OpenClaw 以启动 Gateway
                </p>
              )}
            </DarkCard>

            {/* Logs panel */}
            <DarkCard elevation="low">
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
                Gateway 日志
              </div>
              <div style={{
                height: 300,
                overflowY: 'auto',
                background: '#0a0a0a',
                borderRadius: 8,
                padding: '10px 12px',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 11,
                lineHeight: 1.7,
              }}>
                {gatewayLogLines.length === 0 ? (
                  <div style={{ color: '#555', fontFamily: 'system-ui' }}>
                    暂无日志{!gatewayStatus?.running ? '（Gateway 未启动）' : ''}
                  </div>
                ) : (
                  gatewayLogLines.map((line, i) => (
                    <div
                      key={i}
                      style={{
                        color: line.startsWith('[ERR]') || line.toLowerCase().includes('error')
                          ? '#ff6b6b'
                          : line.toLowerCase().includes('warn')
                          ? '#f59e0b'
                          : line.toLowerCase().includes('success') || line.toLowerCase().includes('started')
                          ? '#4ade80'
                          : '#c4c4c4',
                        wordBreak: 'break-all',
                      }}
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
            </DarkCard>
          </div>
        )}

        {activeTab === 'account' && (
          <div style={{ maxWidth: 520 }}>
            <DarkCard elevation="low">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <Shield size={16} color="#630ed4" />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>账户</div>
              </div>

              {session ? (
                // ── Logged-in view ───────────────────────────────────────────
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 16px',
                      borderRadius: 10,
                      background: 'rgba(99,14,212,0.08)',
                      border: '1px solid rgba(99,14,212,0.2)',
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #630ed4, #7c3aed)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <User size={18} color="#ffffff" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1', marginBottom: 2 }}>
                        {session.user?.email || '已登录用户'}
                      </div>
                      <div style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={11} />
                        已认证
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: 'rgba(74,222,128,0.1)',
                        color: '#4ade80',
                        fontSize: 11,
                        fontWeight: 600,
                        border: '1px solid rgba(74,222,128,0.2)',
                        flexShrink: 0,
                      }}
                    >
                      已登录
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: '#919191', marginBottom: 16, lineHeight: 1.6 }}>
                    登录后可同步学习数据（待办事项、学习记录、成就徽章）到云端。
                  </p>

                  <DarkButton
                    icon={<LogOut size={13} />}
                    label="退出登录"
                    onClick={handleSignOut}
                    variant="outline"
                    size="md"
                  />
                </div>
              ) : (
                // ── Login / Register form ───────────────────────────────────
                <div>
                  <p style={{ fontSize: 12, color: '#919191', marginBottom: 18, lineHeight: 1.6 }}>
                    登录后数据自动同步云端，支持 StudyPage 待办和 ProfilePage 成就。
                  </p>

                  {/* Mode toggle */}
                  <div
                    style={{
                      display: 'flex',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 8,
                      padding: 3,
                      marginBottom: 16,
                    }}
                  >
                    {(['signin', 'signup'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => { setAuthMode(mode); setAuthError(null); setAuthSuccess(null); }}
                        style={{
                          flex: 1,
                          padding: '7px 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: authMode === mode ? 'rgba(255,255,255,0.1)' : 'transparent',
                          color: authMode === mode ? '#e5e2e1' : '#919191',
                          fontSize: 12,
                          fontWeight: authMode === mode ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          fontFamily: 'system-ui, sans-serif',
                        }}
                      >
                        {mode === 'signin' ? '登录' : '注册'}
                      </button>
                    ))}
                  </div>

                  {/* Email input */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 11, color: '#919191', marginBottom: 6, fontWeight: 500 }}>
                      邮箱
                    </label>
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="your@email.com"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#e5e2e1',
                        fontSize: 13,
                        fontFamily: 'system-ui, sans-serif',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(99,14,212,0.5)'; }}
                      onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                    />
                  </div>

                  {/* Password input */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 11, color: '#919191', marginBottom: 6, fontWeight: 500 }}>
                      密码
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="至少 6 位"
                        style={{
                          width: '100%',
                          padding: '9px 40px 9px 12px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(255,255,255,0.04)',
                          color: '#e5e2e1',
                          fontSize: 13,
                          fontFamily: 'system-ui, sans-serif',
                          boxSizing: 'border-box',
                          outline: 'none',
                          transition: 'border-color 0.15s',
                        }}
                        onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(99,14,212,0.5)'; }}
                        onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAuthSubmit(); }}
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#919191',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Error / success */}
                  {authError && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(255,107,107,0.1)',
                        border: '1px solid rgba(255,107,107,0.2)',
                        color: '#ff6b6b',
                        fontSize: 12,
                        marginBottom: 12,
                      }}
                    >
                      {authError}
                    </div>
                  )}
                  {authSuccess && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: 'rgba(74,222,128,0.1)',
                        border: '1px solid rgba(74,222,128,0.2)',
                        color: '#4ade80',
                        fontSize: 12,
                        marginBottom: 12,
                      }}
                    >
                      {authSuccess}
                    </div>
                  )}

                  {/* Submit */}
                  <DarkButton
                    icon={authLoading ? undefined : <LogIn size={13} />}
                    label={authLoading ? (authMode === 'signin' ? '登录中...' : '注册中...') : (authMode === 'signin' ? '登录' : '注册账户')}
                    onClick={handleAuthSubmit}
                    variant="primary"
                    size="md"
                    disabled={authLoading || !authEmail.trim() || authPassword.length < 6}
                    loading={authLoading}
                    style={{ width: '100%' }}
                  />

                  {authMode === 'signup' && (
                    <p style={{ fontSize: 11, color: '#919191', marginTop: 10, textAlign: 'center', lineHeight: 1.5 }}>
                      注册即表示同意我们的服务条款。密码将加密存储。
                    </p>
                  )}
                </div>
              )}
            </DarkCard>
          </div>
        )}

        {/* Log */}
        <div style={{ height: 240, marginTop: 16, maxWidth: 720 }}>
          <DarkTerminal entries={logEntries} autoScroll maxEntries={200} />
        </div>
      </div>
    </div>
  );
}
