import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import { InfoRow } from '../../../shared/components/InfoRow';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import type { SettingsSharedState } from './SettingsContainer';

export function SettingsOverview(props: SettingsSharedState) {
  const { appInfo, openClawStatus, gatewayStatus, runCommand, handleInstallOpenClaw,
    handleRestartGateway, handleStartGateway, installProgress, runningCommand } = props;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {/* App Info */}
      {appInfo && (
        <DarkCard elevation="low">
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>应用程序</div>
            <InfoRow label="版本" value={appInfo.version} />
            <InfoRow label="Electron" value={appInfo.electron} />
            <InfoRow label="Node.js" value={appInfo.node} />
            <InfoRow label="Chrome" value={appInfo.chrome} />
            <InfoRow label="运行环境" value={appInfo.isPackaged ? '生产环境' : '开发模式'} />
            <InfoRow label="数据目录" value={appInfo.userData} />
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
              variant="primary" size="md"
              disabled={runningCommand}
              loading={runningCommand}
            />
            {installProgress && <p style={{ fontSize: 12, color: '#919191', marginTop: 8 }}>{installProgress}</p>}
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
  );
}
