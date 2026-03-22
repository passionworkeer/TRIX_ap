import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, Activity, Server, Bot, Cpu, HardDrive, Package,
  RefreshCw, Play, Square, Stethoscope, Globe, MemoryStick,
} from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import { DarkTerminal, createLogEntry, type LogEntry } from '../components/DarkTerminal';

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

interface SystemInfo {
  cpu: { usage: number; cores: number; model: string };
  memory: { used: number; total: number; usage: number; free: number };
  os: { hostname: string; platform: string; arch: string; version: string; release: string };
}

interface DiskDrive {
  letter: string;
  total: number;
  free: number;
}

interface PkgStatus {
  name: string;
  installed: boolean;
  version?: string;
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

type StatusType = 'idle' | 'loading' | 'success' | 'error';

const StatusDot = ({ running }: { running: boolean }) => (
  <span
    style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: running ? '#4ade80' : '#ff6b6b',
      display: 'inline-block',
      boxShadow: running ? '0 0 6px #4ade80' : '0 0 6px #ff6b6b',
      animation: running ? 'pulse-dot 2s infinite' : 'none',
    }}
  />
);

const MetricCard = ({
  icon: Icon,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}) => (
  <DarkCard elevation="low">
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${iconColor}20`,
          border: `1px solid ${iconColor}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={17} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#919191',
            marginBottom: 3,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#e5e2e1',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: '#919191', marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  </DarkCard>
);

export default function DashboardPage() {
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [openClawStatus, setOpenClawStatus] = useState<OpenClawStatus | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [diskInfo, setDiskInfo] = useState<DiskDrive[]>([]);
  const [packages, setPackages] = useState<PkgStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [, setLogStatus] = useState<StatusType>('idle');

  const addLog = (entry: LogEntry) =>
    setLogEntries((prev) => [...prev.slice(-99), entry]);

  const loadStatus = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const [gw, oc, _info, sys, disk, pkgs] = await Promise.all([
        api.getGatewayStatus(),
        api.checkOpenClaw(),
        api.getAppInfo(),
        api.getSystemInfo(),
        api.getDiskInfo(),
        api.checkPackages(),
      ]);
      setGatewayStatus(gw);
      setOpenClawStatus(oc);
      if (sys.success && sys.data) setSystemInfo(sys.data);
      if (disk.success && disk.data) setDiskInfo(disk.data);
      if (pkgs.success && pkgs.data) setPackages(pkgs.data);
    } catch (err) {
      addLog(createLogEntry('error', `状态加载失败: ${String(err)}`));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    addLog(createLogEntry('info', 'TRIX Companion 控制台已初始化'));
  }, [loadStatus]);

  const runCommand = async (cmd: string, label: string) => {
    const api = window.electronAPI;
    if (!api) return;
    setActionLoading((prev) => ({ ...prev, [cmd]: true }));
    setLogStatus('loading');
    addLog(createLogEntry('command', `[${label}] $ ${cmd}`));
    const result: CommandResult = await api.runOpenClawCommand(cmd);
    const output = result.stdout || result.stderr || result.error || '无输出';
    output.split('\n').forEach((line) => {
      if (line.trim()) {
        addLog(
          createLogEntry(
            result.success ? 'output' : 'error',
            line,
          ),
        );
      }
    });
    setLogStatus(result.success ? 'success' : 'error');
    addLog(
      createLogEntry(result.success ? 'success' : 'error', `[${label}] ${result.success ? '完成' : '失败'}`),
    );
    await loadStatus();
    setActionLoading((prev) => ({ ...prev, [cmd]: false }));
  };

  const handleRestart = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setActionLoading((prev) => ({ ...prev, restart: true }));
    setLogStatus('loading');
    addLog(createLogEntry('warning', '[Gateway] 正在重启...'));
    try {
      await api.restartGateway();
      addLog(createLogEntry('success', '[Gateway] 重启成功'));
      setLogStatus('success');
    } catch (err) {
      addLog(createLogEntry('error', `[Gateway] 重启失败: ${String(err)}`));
      setLogStatus('error');
    }
    await loadStatus();
    setActionLoading((prev) => ({ ...prev, restart: false }));
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
          <p style={{ color: '#919191', fontSize: 13 }}>加载系统状态...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '28px 32px',
        background: '#131313',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <style>{`@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#e5e2e1',
              margin: 0,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '-0.02em',
            }}
          >
            控制台
          </h1>
          <p
            style={{
              fontSize: 13,
              color: '#919191',
              margin: '5px 0 0',
            }}
          >
            管理 Gateway、Agent 与消息渠道
          </p>
        </div>
        <DarkButton
          icon={<RefreshCw size={14} />}
          label="刷新"
          onClick={loadStatus}
          variant="outline"
          size="md"
        />
      </div>

      {/* Status Banner */}
      <DarkCard
        glass
        elevation="container"
        style={{
          marginBottom: 24,
          background: gatewayStatus?.running
            ? 'rgba(74, 222, 128, 0.04)'
            : 'rgba(255, 107, 107, 0.04)',
          border: gatewayStatus?.running
            ? '1px solid rgba(74, 222, 128, 0.15)'
            : '1px solid rgba(255, 107, 107, 0.15)',
          padding: '18px 22px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Status icon */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: gatewayStatus?.running
                ? 'rgba(74, 222, 128, 0.1)'
                : 'rgba(255, 107, 107, 0.1)',
              border: `1px solid ${gatewayStatus?.running ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 107, 107, 0.2)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Zap size={24} color={gatewayStatus?.running ? '#4ade80' : '#ff6b6b'} />
          </div>

          {/* Status text */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <StatusDot running={!!gatewayStatus?.running} />
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#e5e2e1',
                }}
              >
                {gatewayStatus?.running ? 'Gateway 运行中' : 'Gateway 未运行'}
              </span>
            </div>
            {gatewayStatus?.running ? (
              <div style={{ fontSize: 12, color: '#919191' }}>
                端口 {gatewayStatus.port} · {gatewayStatus.url}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#919191' }}>
                {openClawStatus?.installed
                  ? 'Gateway 未启动，请点击右侧「启动」按钮'
                  : 'OpenClaw 未安装，请先安装'}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {openClawStatus?.installed && (
              <>
                {gatewayStatus?.running ? (
                  <DarkButton
                    icon={<Square size={13} />}
                    label="停止"
                    onClick={handleRestart}
                    variant="danger"
                    loading={!!actionLoading.restart}
                    size="md"
                  />
                ) : (
                  <DarkButton
                    icon={<Play size={13} />}
                    label="启动"
                    onClick={handleRestart}
                    variant="primary"
                    loading={!!actionLoading.restart}
                    size="md"
                  />
                )}
              </>
            )}
            <DarkButton
              icon={<Stethoscope size={13} />}
              label="诊断"
              onClick={() => runCommand('doctor', '健康检查')}
              variant="outline"
              loading={!!actionLoading.doctor}
              size="md"
            />
            <DarkButton
              icon={<Activity size={13} />}
              label="状态"
              onClick={() => runCommand('status', '系统状态')}
              variant="outline"
              loading={!!actionLoading.status}
              size="md"
            />
          </div>
        </div>
      </DarkCard>

      {/* Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <MetricCard
          icon={Server}
          iconColor="#818cf8"
          label="Gateway 端口"
          value={String(gatewayStatus?.port ?? '—')}
          sub="WebSocket 通信"
        />
        <MetricCard
          icon={Bot}
          iconColor="#a78bfa"
          label="OpenClaw 版本"
          value={openClawStatus?.version ?? '未安装'}
          sub={openClawStatus?.installed ? '已安装' : '运行安装以使用'}
        />
        <MetricCard
          icon={Cpu}
          iconColor="#34d399"
          label="CPU 占用"
          value={systemInfo ? `${systemInfo.cpu.usage}%` : '—'}
          sub={systemInfo ? `${systemInfo.cpu.cores} 核 · ${systemInfo.cpu.model.slice(0, 28)}` : '加载中…'}
        />
        <MetricCard
          icon={MemoryStick}
          iconColor="#fb923c"
          label="内存占用"
          value={systemInfo ? `${systemInfo.memory.usage}%` : '—'}
          sub={systemInfo ? `已用 ${systemInfo.memory.used} GB / ${systemInfo.memory.total} GB` : '加载中…'}
        />
        <MetricCard
          icon={HardDrive}
          iconColor="#fbbf24"
          label="磁盘占用"
          value={
            diskInfo.length > 0
              ? diskInfo
                  .map((d) => `${d.letter} ${Math.round((1 - d.free / d.total) * 100)}%`)
                  .join(' · ')
              : '—'
          }
          sub={
            diskInfo.length > 0
              ? diskInfo
                  .map((d) => `${d.letter} ${d.free} GB 可用 / ${d.total} GB`)
                  .join(' · ')
              : '加载中…'
          }
        />
        <MetricCard
          icon={Activity}
          iconColor="#60a5fa"
          label="设备名称"
          value={systemInfo?.os.hostname ?? '—'}
          sub={systemInfo ? `${systemInfo.os.version} (${systemInfo.os.arch})` : '加载中…'}
        />
      </div>

      {/* Installed Packages */}
      {packages.length > 0 && (
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Package size={14} color="#919191" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#919191',
              }}
            >
              已安装的全局包
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {packages.map((pkg) => (
              <div
                key={pkg.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 8,
                  background: pkg.installed ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${pkg.installed ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: pkg.installed ? '#4ade80' : '#ff6b6b',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: pkg.installed ? '#4ade80' : '#919191',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {pkg.name}
                </span>
                {pkg.version && (
                  <span style={{ fontSize: 11, color: '#666', fontFamily: "'JetBrains Mono', monospace" }}>
                    {pkg.version}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gateway URL */}
      {gatewayStatus?.running && gatewayStatus?.url && (
        <div
          style={{
            background: 'rgba(129, 140, 248, 0.05)',
            border: '1px solid rgba(129, 140, 248, 0.12)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Globe size={15} color="#818cf8" />
          <span
            style={{
              fontSize: 12,
              color: '#818cf8',
              flex: 1,
              fontFamily: "'JetBrains Mono', monospace",
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {gatewayStatus.url}
          </span>
          <DarkButton
            label="复制"
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(gatewayStatus.url ?? '');
              addLog(createLogEntry('success', '[Gateway] URL 已复制到剪贴板'));
            }}
          />
        </div>
      )}

      {/* Terminal Log */}
      <div style={{ height: 280 }}>
        <DarkTerminal
          entries={logEntries}
          autoScroll
          maxEntries={200}
        />
      </div>
    </div>
  );
}
