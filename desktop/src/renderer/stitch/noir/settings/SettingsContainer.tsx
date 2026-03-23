import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { TabButton, type SettingsTab } from '../../../shared/components/TabButton';
import { DarkButton } from '../components/DarkButton';
import { DarkTerminal, createLogEntry, type LogEntry } from '../components/DarkTerminal';
import { SettingsOverview } from './SettingsOverview';
import { SettingsAgents } from './SettingsAgents';
import { SettingsSkills } from './SettingsSkills';
import { SettingsBackups } from './SettingsBackups';
import { SettingsPairing } from './SettingsPairing';
import { SettingsGateway } from './SettingsGateway';
import { SettingsChannels } from './SettingsChannels';
import { SettingsPlugins } from './SettingsPlugins';
import { SettingsAccount } from './SettingsAccount';
import { SettingsModels } from './SettingsModels';
import { SettingsCron } from './SettingsCron';
import { StartupCheckDialog } from '../../../shared/components/StartupCheckDialog';

export interface SettingsSharedState {
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  openClawStatus: { installed: boolean; version?: string; path?: string; error?: string } | null;
  gatewayStatus: { running: boolean; port?: number; pid?: number; url?: string; error?: string } | null;
  appInfo: { version: string; name: string; electron: string; node: string; chrome: string; platform: string; userData: string; isPackaged: boolean } | null;
  installProgress: string | null;
  loading: boolean;
  logEntries: LogEntry[];
  runningCommand: boolean;
  gatewayLogLines: string[];
  addLog: (entry: LogEntry) => void;
  loadStatus: () => Promise<void>;
  loadGatewayLogs: () => Promise<void>;
  runCommand: (cmd: string, label: string) => Promise<void>;
  handleInstallOpenClaw: () => Promise<void>;
  handleStartGateway: () => Promise<void>;
  handleStopGateway: () => Promise<void>;
  handleRestartGateway: () => Promise<void>;
}

export default function SettingsContainer() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview');
  const [openClawStatus, setOpenClawStatus] = useState<SettingsSharedState['openClawStatus']>(null);
  const [gatewayStatus, setGatewayStatus] = useState<SettingsSharedState['gatewayStatus']>(null);
  const [appInfo, setAppInfo] = useState<SettingsSharedState['appInfo']>(null);
  const [installProgress, setInstallProgress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [runningCommand, setRunningCommand] = useState(false);
  const [gatewayLogLines, setGatewayLogLines] = useState<string[]>([]);
  const [showStartupCheck, setShowStartupCheck] = useState(false);

  const addLog = useCallback((entry: LogEntry) => {
    setLogEntries((prev) => [...prev.slice(-99), entry]);
  }, []);

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
  }, [addLog]);

  const loadGatewayLogs = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    try {
      const result = await api.gatewayLogs({ lines: 150 });
      if (result.success && result.data) setGatewayLogLines(result.data);
    } catch { /* ignore */ }
  }, []);

  const runCommand = useCallback(async (cmd: string, label: string) => {
    const api = window.electronAPI;
    if (!api) return;
    setRunningCommand(true);
    addLog(createLogEntry('command', `$ ${cmd}`));
    try {
      const result = await api.runOpenClawCommand(cmd);
      const output = result.stdout || result.stderr || result.error || '无输出';
      output.split('\n').forEach((line) => {
        if (line.trim()) addLog(createLogEntry(result.success ? 'output' : 'error', line));
      });
      addLog(createLogEntry(result.success ? 'success' : 'error', `${label} ${result.success ? '成功' : '失败'}`));
    } catch (err) {
      addLog(createLogEntry('error', `执行失败: ${String(err)}`));
    }
    setRunningCommand(false);
  }, [addLog]);

  const handleInstallOpenClaw = useCallback(async () => {
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
  }, [addLog, loadStatus]);

  const handleStartGateway = useCallback(async () => {
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
  }, [addLog, loadStatus, loadGatewayLogs]);

  const handleStopGateway = useCallback(async () => {
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
  }, [addLog, loadStatus, loadGatewayLogs]);

  const handleRestartGateway = useCallback(async () => {
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
  }, [addLog, loadStatus, loadGatewayLogs]);

  useEffect(() => {
    loadStatus();
    const api = window.electronAPI;
    if (!api) return;
    const unsubProgress = api.onInstallProgress?.((msg) => {
      setInstallProgress(msg);
      addLog(createLogEntry('info', msg));
    });
    return () => { unsubProgress?.(); };
  }, [loadStatus, addLog]);

  // Auto-run startup environment check on mount
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    api.checkPackages().then(result => {
      if (result.success && result.data) {
        const missing = result.data.filter((p: { installed?: boolean }) => !p.installed);
        if (missing.length > 0) setShowStartupCheck(true);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'gateway') loadGatewayLogs();
  }, [activeTab, gatewayStatus, loadGatewayLogs]);

  const shared: SettingsSharedState = {
    activeTab, setActiveTab,
    openClawStatus, gatewayStatus, appInfo,
    installProgress, loading,
    logEntries, runningCommand, gatewayLogLines,
    addLog, loadStatus, loadGatewayLogs,
    runCommand, handleInstallOpenClaw,
    handleStartGateway, handleStopGateway, handleRestartGateway,
  };

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#131313', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#ffffff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#919191', fontSize: 13 }}>加载设置...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#131313', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e5e2e1', margin: 0 }}>桌面设置</h1>
            <p style={{ fontSize: 12, color: '#919191', margin: '4px 0 0' }}>TRIX Companion Windows 桌面版</p>
          </div>
          <DarkButton icon={<RefreshCw size={13} />} label="刷新" onClick={loadStatus} variant="outline" size="md" />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(Object.keys({
            overview: true, agents: true, models: true, cron: true,
            skills: true, backups: true, pairing: true, gateway: true,
            channels: true, plugins: true, account: true,
          }) as SettingsTab[]).map((tab) => (
            <TabButton key={tab} tab={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 28px 28px' }}>
        {activeTab === 'overview' && <SettingsOverview {...shared} />}
        {activeTab === 'agents' && <SettingsAgents {...shared} />}
        {activeTab === 'models' && <SettingsModels {...shared} />}
        {activeTab === 'cron' && <SettingsCron {...shared} />}
        {activeTab === 'skills' && <SettingsSkills {...shared} />}
        {activeTab === 'backups' && <SettingsBackups {...shared} />}
        {activeTab === 'pairing' && <SettingsPairing {...shared} />}
        {activeTab === 'gateway' && <SettingsGateway {...shared} />}
        {activeTab === 'channels' && <SettingsChannels {...shared} />}
        {activeTab === 'plugins' && <SettingsPlugins {...shared} />}
        {activeTab === 'account' && <SettingsAccount {...shared} />}

        {/* Shared Log */}
        <div style={{ height: 240, marginTop: 16, maxWidth: 720 }}>
          <DarkTerminal entries={logEntries} autoScroll maxEntries={200} />
        </div>
      </div>

      {/* Startup Environment Check Dialog */}
      {showStartupCheck && (
        <StartupCheckDialog onClose={() => setShowStartupCheck(false)} />
      )}
    </div>
  );
}
