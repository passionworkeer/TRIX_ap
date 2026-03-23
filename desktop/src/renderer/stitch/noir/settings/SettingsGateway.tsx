import { Play, Square, RefreshCw } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import { InfoRow } from '../../../shared/components/InfoRow';
import type { SettingsSharedState } from './SettingsContainer';

export function SettingsGateway(props: SettingsSharedState) {
  const { gatewayStatus, openClawStatus, runningCommand, handleStartGateway,
    handleStopGateway, handleRestartGateway, loadGatewayLogs, gatewayLogLines } = props;

  return (
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
                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', color: '#ff6b6b', fontSize: 12 }}>
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
              <DarkButton icon={<RefreshCw size={13} />} label="重启" onClick={handleRestartGateway} variant="primary" size="md" disabled={runningCommand} loading={runningCommand} />
              <DarkButton icon={<Square size={13} />} label="停止" onClick={handleStopGateway} variant="outline" size="md" disabled={runningCommand} loading={runningCommand} />
            </>
          ) : (
            <DarkButton icon={<Play size={13} />} label="启动" onClick={handleStartGateway} variant="primary" size="md" disabled={runningCommand || !openClawStatus?.installed} loading={runningCommand} />
          )}
          <DarkButton icon={<RefreshCw size={13} />} label="刷新日志" onClick={loadGatewayLogs} variant="outline" size="md" />
        </div>
        {!openClawStatus?.installed && (
          <p style={{ fontSize: 11, color: '#919191', marginTop: 8 }}>请先安装 OpenClaw 以启动 Gateway</p>
        )}
      </DarkCard>

      {/* Logs panel */}
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>Gateway 日志</div>
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
  );
}
