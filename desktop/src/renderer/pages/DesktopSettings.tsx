import React, { useState, useEffect, useCallback } from 'react';

// Inject status badge styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .status-installed { background: rgba(34,197,94,0.15) !important; color: #22c55e !important; }
    .status-not-installed { background: rgba(239,68,68,0.15) !important; color: #ef4444 !important; }
    .status-running { background: rgba(34,197,94,0.15) !important; color: #22c55e !important; }
    .status-stopped { background: rgba(239,68,68,0.15) !important; color: #ef4444 !important; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
}

// Types
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

export default function DesktopSettings() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [openClawStatus, setOpenClawStatus] = useState<OpenClawStatus | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [installProgress, setInstallProgress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [commandOutput, setCommandOutput] = useState<string>('');
  const [runningCommand, setRunningCommand] = useState(false);

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
      console.error('Failed to load status:', err);
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
    });

    return () => {
      unsubProgress?.();
    };
  }, [loadStatus]);

  const handleInstallOpenClaw = async () => {
    const api = window.electronAPI;
    if (!api) return;

    setInstallProgress('正在初始化安装...');
    setRunningCommand(true);
    try {
      const result = await api.installOpenClaw();
      if (result.success) {
        setInstallProgress('安装完成！');
        await loadStatus();
      } else {
        setInstallProgress(`安装失败: ${result.error}`);
      }
    } finally {
      setRunningCommand(false);
    }
  };

  const runCommand = async (cmd: string, label: string) => {
    const api = window.electronAPI;
    if (!api) return;

    setRunningCommand(true);
    setCommandOutput(`[${label}] 执行中...\n`);
    try {
      const result: CommandResult = await api.runOpenClawCommand(cmd);
      setCommandOutput(
        result.success
          ? `${result.stdout}\n${result.stderr || ''}`
          : `错误: ${result.error || result.stderr}`
      );
    } catch (err) {
      setCommandOutput(`执行失败: ${String(err)}`);
    } finally {
      setRunningCommand(false);
    }
  };

  const handleRestartGateway = async () => {
    const api = window.electronAPI;
    if (!api) return;

    setRunningCommand(true);
    setCommandOutput('正在重启 Gateway...\n');
    try {
      const result = await api.restartGateway();
      if (result.success) {
        setCommandOutput('Gateway 已重启!');
        await loadStatus();
      } else {
        setCommandOutput(`重启失败: ${result.error}`);
      }
    } finally {
      setRunningCommand(false);
    }
  };

  const handleCreatePairingCode = async () => {
    await runCommand('pairing create', '生成配对码');
  };

  const handleDoctor = async () => {
    await runCommand('doctor', '健康检查');
  };

  const handleStatus = async () => {
    await runCommand('status', '状态');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>桌面设置</h1>
        <p style={styles.subtitle}>TRIX Companion Windows 桌面版</p>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(['overview', 'agents', 'skills', 'backups', 'pairing', 'gateway'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={styles.content}>
        {activeTab === 'overview' && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>系统概览</h2>

            {/* App Info */}
            {appInfo && (
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>应用程序</h3>
                <div style={styles.grid}>
                  <InfoRow label="版本" value={appInfo.version} />
                  <InfoRow label="Electron" value={appInfo.electron} />
                  <InfoRow label="Node.js" value={appInfo.node} />
                  <InfoRow label="Chrome" value={appInfo.chrome} />
                  <InfoRow label="打包状态" value={appInfo.isPackaged ? '生产环境' : '开发模式'} />
                  <InfoRow label="数据目录" value={appInfo.userData} />
                </div>
              </div>
            )}

            {/* OpenClaw Status */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>OpenClaw 状态</h3>
              {openClawStatus?.installed ? (
                <>
                  <div style={styles.statusBadge} className="status-installed">
                    ✓ 已安装
                  </div>
                  <div style={styles.grid}>
                    <InfoRow label="版本" value={openClawStatus.version || '未知'} />
                    <InfoRow label="路径" value={openClawStatus.path || 'PATH'} />
                  </div>
                  <div style={styles.buttonRow}>
                    <button onClick={handleDoctor} style={styles.btnSecondary} disabled={runningCommand}>
                      运行诊断
                    </button>
                    <button onClick={handleStatus} style={styles.btnSecondary} disabled={runningCommand}>
                      查看状态
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.statusBadge} className="status-not-installed">
                    ✗ 未安装
                  </div>
                  <p style={styles.hint}>
                    OpenClaw 是 TRIX Companion 的核心运行时，安装后可使用 AI Agent、Skill 管理和配对码等功能。
                  </p>
                  <button
                    onClick={handleInstallOpenClaw}
                    style={styles.btnPrimary}
                    disabled={runningCommand}
                  >
                    {runningCommand ? (installProgress || '安装中...') : '安装 OpenClaw'}
                  </button>
                  {installProgress && (
                    <p style={styles.progressText}>{installProgress}</p>
                  )}
                </>
              )}
            </div>

            {/* Gateway Status */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Gateway 状态</h3>
              {gatewayStatus?.running ? (
                <>
                  <div style={styles.statusBadge} className="status-running">
                    ✓ 运行中
                  </div>
                  <div style={styles.grid}>
                    <InfoRow label="端口" value={String(gatewayStatus.port || 18789)} />
                    <InfoRow label="地址" value={gatewayStatus.url || `ws://127.0.0.1:${gatewayStatus.port || 18789}`} />
                  </div>
                  <div style={styles.buttonRow}>
                    <button onClick={handleRestartGateway} style={styles.btnSecondary} disabled={runningCommand}>
                      重启 Gateway
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.statusBadge} className="status-stopped">
                    ✗ 已停止
                  </div>
                  <p style={styles.hint}>
                    Gateway 负责 WebSocket 通信。启动 OpenClaw 后可以启动 Gateway。
                  </p>
                  {openClawStatus?.installed && (
                    <button onClick={handleRestartGateway} style={styles.btnSecondary} disabled={runningCommand}>
                      启动 Gateway
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Agent 管理</h2>
            <div style={styles.card}>
              <p style={styles.hint}>查看和切换 AI Agent/模型</p>
              <div style={styles.buttonRow}>
                <button
                  onClick={() => runCommand('agents list', 'Agent 列表')}
                  style={styles.btnSecondary}
                  disabled={runningCommand}
                >
                  列出 Agents
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'skills' && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Skill 管理</h2>
            <div style={styles.card}>
              <p style={styles.hint}>安装和卸载 OpenClaw Skills</p>
              <div style={styles.buttonRow}>
                <button
                  onClick={() => runCommand('skills list', 'Skill 列表')}
                  style={styles.btnSecondary}
                  disabled={runningCommand}
                >
                  列出 Skills
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'backups' && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>配置备份与回滚</h2>
            <div style={styles.card}>
              <p style={styles.hint}>管理配置备份，恢复到之前的版本</p>
              <div style={styles.buttonRow}>
                <button
                  onClick={() => runCommand('backup list', '备份列表')}
                  style={styles.btnSecondary}
                  disabled={runningCommand}
                >
                  列出备份
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pairing' && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>配对码</h2>
            <div style={styles.card}>
              <p style={styles.hint}>生成配对码连接 TRIX Native 设备</p>
              <div style={styles.buttonRow}>
                <button
                  onClick={handleCreatePairingCode}
                  style={styles.btnPrimary}
                  disabled={runningCommand}
                >
                  生成配对码
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'gateway' && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Gateway 管理</h2>
            <div style={styles.card}>
              <div style={styles.buttonRow}>
                <button
                  onClick={handleRestartGateway}
                  style={styles.btnPrimary}
                  disabled={runningCommand}
                >
                  重启 Gateway
                </button>
                <button
                  onClick={() => runCommand('gateway status', 'Gateway 状态')}
                  style={styles.btnSecondary}
                  disabled={runningCommand}
                >
                  查看状态
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Command Output */}
        {commandOutput && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>输出</h3>
            <pre style={styles.output}>{commandOutput}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

const TAB_LABELS: Record<Tab, string> = {
  overview: '概览',
  agents: 'Agents',
  skills: 'Skills',
  backups: '备份',
  pairing: '配对码',
  gateway: 'Gateway',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#e2e8f0',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
  },
  loading: {
    textAlign: 'center',
    marginTop: '48px',
    color: '#94a3b8',
    fontSize: '16px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f8fafc',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: '4px 0 0',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
    borderBottom: '1px solid #1e293b',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '8px 16px',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: '14px',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    marginBottom: '-1px',
    transition: 'all 0.15s',
  },
  tabActive: {
    color: '#818cf8',
    borderBottomColor: '#818cf8',
  },
  content: {},
  section: {},
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#f1f5f9',
    marginBottom: '16px',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid #334155',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#e2e8f0',
    margin: '0 0 12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '8px',
    marginBottom: '12px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    borderBottom: '1px solid #334155',
  },
  infoLabel: {
    color: '#94a3b8',
    fontSize: '13px',
  },
  infoValue: {
    color: '#e2e8f0',
    fontSize: '13px',
    wordBreak: 'break-all',
    textAlign: 'right',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '12px',
  },
  hint: {
    color: '#94a3b8',
    fontSize: '13px',
    lineHeight: 1.5,
    marginBottom: '12px',
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '12px',
  },
  btnPrimary: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#6366f1',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  btnSecondary: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #475569',
    backgroundColor: 'transparent',
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  progressText: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#94a3b8',
  },
  output: {
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '12px',
    color: '#e2e8f0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    maxHeight: '300px',
    overflow: 'auto',
    fontFamily: 'ui-monospace, monospace',
  },
};
