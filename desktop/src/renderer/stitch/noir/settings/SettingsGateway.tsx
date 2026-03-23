import { useState, useEffect, useCallback } from 'react';
import { Play, Square, RefreshCw, Save, Eye, EyeOff, Copy, AlertTriangle } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import { InfoRow } from '../../../shared/components/InfoRow';
import type { SettingsSharedState } from './SettingsContainer';

interface GatewayConfig {
  port?: number;
  mode?: string;
  bind?: string;
  controlUi?: { allowedOrigins?: string[] };
  auth?: { mode?: string; token?: string };
  tailscale?: { mode?: string; resetOnExit?: boolean };
}

interface FieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}

function Field({ label, value, onChange, type = 'text', hint }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: '#0e0e0e',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: '7px 10px',
          color: '#e5e2e1',
          fontSize: 13,
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      {hint && <div style={{ fontSize: 11, color: '#555' }}>{hint}</div>}
    </div>
  );
}

export function SettingsGateway(props: SettingsSharedState) {
  const { gatewayStatus, openClawStatus, runningCommand, handleStartGateway,
    handleStopGateway, handleRestartGateway, loadGatewayLogs, gatewayLogLines } = props;

  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [origins, setOrigins] = useState<string[]>([]);
  const [newOrigin, setNewOrigin] = useState('');
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const loadConfig = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const result = await api.configReadSection('gateway');
      if (result.success) {
        const cfg = result.data as GatewayConfig;
        setConfig(cfg || {});
        setOrigins(cfg?.controlUi?.allowedOrigins || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveConfig = useCallback(async (updated: GatewayConfig, restartGw = false) => {
    const api = window.electronAPI;
    if (!api) return false;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const section = { ...updated, controlUi: { allowedOrigins: origins } };
      const result = await api.configWriteSection('gateway', section);
      if (result.success) {
        setConfig(section);
        setSuccessMsg('配置已保存');
        setTimeout(() => setSuccessMsg(null), 3000);
        if (restartGw && gatewayStatus?.running) {
          setShowRestartConfirm(true);
        }
        return true;
      } else {
        setError(result.error || '保存失败');
        return false;
      }
    } catch {
      setError('保存失败');
      return false;
    } finally {
      setSaving(false);
    }
  }, [origins, gatewayStatus]);

  const handleSave = (restart = false) => saveConfig(config!, restart);

  const addOrigin = () => {
    const trimmed = newOrigin.trim();
    if (!trimmed || origins.includes(trimmed)) return;
    setOrigins(prev => [...prev, trimmed]);
    setNewOrigin('');
  };

  const removeOrigin = (o: string) => setOrigins(prev => prev.filter(x => x !== o));

  const copyToken = () => {
    if (config?.auth?.token) {
      navigator.clipboard.writeText(config.auth.token).catch(() => {});
    }
  };

  if (loading) {
    return <div style={{ color: '#919191', fontSize: 13 }}>加载配置中...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {/* Status card */}
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 14 }}>Gateway 状态</div>
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

      {/* Gateway Config Editor */}
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>Gateway 配置</div>
          <DarkButton label="保存配置" icon={<Save size={12} />} onClick={() => handleSave(false)} variant="primary" size="sm" disabled={saving} loading={saving} />
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, color: '#4ade80', fontSize: 12, marginBottom: 14 }}>
            {successMsg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <Field
            label="端口"
            value={String(config?.port || 18789)}
            onChange={v => setConfig(c => ({ ...c!, port: parseInt(v) || 18789 }))}
            type="number"
            hint="1-65535"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em' }}>运行模式</label>
            <select
              value={config?.mode || 'local'}
              onChange={e => setConfig(c => ({ ...c!, mode: e.target.value }))}
              style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 13, outline: 'none' }}
            >
              <option value="local">local</option>
              <option value="remote">remote</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em' }}>绑定方式</label>
            <select
              value={config?.bind || 'loopback'}
              onChange={e => setConfig(c => ({ ...c!, bind: e.target.value }))}
              style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 13, outline: 'none' }}
            >
              <option value="loopback">loopback（仅本地）</option>
              <option value="all">all（所有网络）</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tailscale</label>
            <select
              value={config?.tailscale?.mode || 'off'}
              onChange={e => setConfig(c => ({ ...c!, tailscale: { ...c?.tailscale, mode: e.target.value } }))}
              style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 13, outline: 'none' }}
            >
              <option value="off">关闭</option>
              <option value="on">开启</option>
            </select>
          </div>
        </div>

        {/* Auth Token */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>认证 Token</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                value={config?.auth?.token || ''}
                onChange={e => setConfig(c => ({ ...c!, auth: { ...c?.auth!, token: e.target.value } }))}
                style={{
                  width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '7px 36px 7px 10px', color: '#e5e2e1', fontSize: 12,
                  fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#919191' }} onClick={() => setShowToken(s => !s)}>
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </div>
            </div>
            <DarkButton label="复制" icon={<Copy size={11} />} onClick={copyToken} variant="ghost" size="sm" />
          </div>
        </div>

        {/* Allowed Origins */}
        <div>
          <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Allowed Origins</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {origins.map(o => (
              <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: 6, fontSize: 11, color: '#e5e2e1', fontFamily: 'monospace' }}>
                {o}
                <span style={{ cursor: 'pointer', color: '#ff6b6b', marginLeft: 2 }} onClick={() => removeOrigin(o)}>×</span>
              </div>
            ))}
            {origins.length === 0 && <div style={{ fontSize: 12, color: '#555' }}>暂无</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newOrigin}
              onChange={e => setNewOrigin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addOrigin()}
              placeholder="https://example.com"
              style={{ flex: 1, background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#e5e2e1', fontSize: 12, outline: 'none' }}
            />
            <DarkButton label="添加" onClick={addOrigin} variant="outline" size="sm" disabled={!newOrigin.trim()} />
          </div>
        </div>
      </DarkCard>

      {/* Save with Restart */}
      {gatewayStatus?.running && (
        <DarkCard elevation="low">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <div style={{ flex: 1, fontSize: 13, color: '#e5e2e1' }}>配置变更后需要重启 Gateway 才能生效</div>
            <DarkButton
              label="保存并重启"
              icon={<Save size={12} />}
              onClick={() => handleSave(true)}
              variant="primary"
              size="sm"
              disabled={saving}
              loading={saving}
            />
          </div>
        </DarkCard>
      )}

      {/* Restart confirmation */}
      {showRestartConfirm && (
        <div style={{ padding: '12px 16px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 10, fontSize: 13, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} />
          配置已保存，正在重启 Gateway...
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', width: 16, height: 16, border: '2px solid rgba(74,222,128,0.3)', borderTopColor: '#4ade80', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Logs panel */}
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>Gateway 日志</div>
          <DarkButton label="刷新" icon={<RefreshCw size={11} />} onClick={loadGatewayLogs} variant="ghost" size="sm" />
        </div>
        <div style={{
          height: 300, overflowY: 'auto', background: '#0a0a0a', borderRadius: 8,
          padding: '10px 12px', fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 11, lineHeight: 1.7,
        }}>
          {gatewayLogLines.length === 0 ? (
            <div style={{ color: '#555', fontFamily: 'system-ui' }}>暂无日志</div>
          ) : gatewayLogLines.map((line, i) => (
            <div key={i} style={{
              color: line.startsWith('[ERR]') || line.toLowerCase().includes('error') ? '#ff6b6b'
                : line.toLowerCase().includes('warn') ? '#f59e0b'
                : line.toLowerCase().includes('success') || line.toLowerCase().includes('started') ? '#4ade80'
                : '#c4c4c4',
              wordBreak: 'break-all',
            }}>{line}</div>
          ))}
        </div>
      </DarkCard>
    </div>
  );
}
