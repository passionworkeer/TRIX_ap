import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, Zap, FolderOpen, Link, Server,
  Info, CheckCircle, XCircle, RefreshCw,
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
  url?: string;
  error?: string;
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

type Tab = 'overview' | 'agents' | 'skills' | 'backups' | 'pairing' | 'gateway';

const TAB_LABELS: Record<Tab, { label: string; icon: React.ElementType }> = {
  overview: { label: '概览', icon: Info },
  agents: { label: 'Agents', icon: Bot },
  skills: { label: 'Skills', icon: Zap },
  backups: { label: '备份', icon: FolderOpen },
  pairing: { label: '配对码', icon: Link },
  gateway: { label: 'Gateway', icon: Server },
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

  const handleRestartGateway = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setRunningCommand(true);
    addLog(createLogEntry('warning', '正在重启 Gateway...'));
    try {
      const result = await api.restartGateway();
      if (result.success) {
        addLog(createLogEntry('success', 'Gateway 重启成功'));
        await loadStatus();
      } else {
        addLog(createLogEntry('error', `重启失败: ${result.error}`));
      }
    } finally {
      setRunningCommand(false);
    }
  };

  const handleCreatePairingCode = async () => {
    await runCommand('pairing create', '生成配对码');
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
                    <DarkButton label="启动 Gateway" onClick={handleRestartGateway} variant="primary" size="md" />
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
          <div style={{ maxWidth: 720 }}>
            <DarkCard elevation="low">
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
                配对码
              </div>
              <p style={{ fontSize: 12, color: '#919191', marginBottom: 14 }}>
                生成配对码连接 TRIX Native 设备
              </p>
              <DarkButton
                label="生成配对码"
                onClick={handleCreatePairingCode}
                variant="primary"
                size="md"
                disabled={runningCommand}
                loading={runningCommand}
              />
            </DarkCard>
          </div>
        )}

        {activeTab === 'gateway' && (
          <div style={{ maxWidth: 720 }}>
            <DarkCard elevation="low">
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 14 }}>
                Gateway 管理
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <DarkButton
                  label="重启 Gateway"
                  onClick={handleRestartGateway}
                  variant="primary"
                  size="md"
                  disabled={runningCommand}
                />
                <DarkButton
                  label="查看状态"
                  onClick={() => runCommand('gateway status', 'Gateway 状态')}
                  variant="outline"
                  size="md"
                  disabled={runningCommand}
                />
              </div>
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
