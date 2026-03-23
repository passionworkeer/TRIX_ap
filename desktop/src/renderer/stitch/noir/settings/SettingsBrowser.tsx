import { useState, useEffect, useCallback } from 'react';
import { Globe, Save, FolderOpen, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

interface BrowserConfig {
  cdpUrl?: string;
  executablePath?: string;
  attachOnly?: boolean;
  headless?: boolean;
  userDataDir?: string;
  args?: string[];
}

export function SettingsBrowser(_props: SettingsSharedState) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  // Draft state
  const [cdpUrl, setCdpUrl] = useState('');
  const [executablePath, setExecutablePath] = useState('');
  const [attachOnly, setAttachOnly] = useState(false);
  const [headless, setHeadless] = useState(false);
  const [userDataDir, setUserDataDir] = useState('');
  const [extraArgs, setExtraArgs] = useState('');

  const loadConfig = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const result = await api.configReadSection('browser');
      if (result.success) {
        const cfg = result.data as BrowserConfig;
        setCdpUrl(cfg?.cdpUrl || 'http://127.0.0.1:9222');
        setExecutablePath(cfg?.executablePath || '');
        setAttachOnly(cfg?.attachOnly ?? true);
        setHeadless(cfg?.headless ?? false);
        setUserDataDir(cfg?.userDataDir || '');
        setExtraArgs((cfg?.args || []).join(' '));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveConfig = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setSaving(true);
    setError(null);
    try {
      const args = extraArgs.trim() ? extraArgs.trim().split(/\s+/) : [];
      const updated: BrowserConfig = {
        cdpUrl,
        executablePath,
        attachOnly,
        headless,
        userDataDir: userDataDir || undefined,
        args: args.length > 0 ? args : undefined,
      };
      const result = await api.configWriteSection('browser', updated);
      if (result.success) {
        setSuccessMsg('配置已保存');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(result.error || '保存失败');
      }
    } catch {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  }, [cdpUrl, executablePath, attachOnly, headless, userDataDir, extraArgs]);

  const testConnection = useCallback(async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const res = await fetch(cdpUrl.replace('ws://', 'http://').replace('ws://', 'http://') + '/json/version', {
        signal: AbortSignal.timeout(5000),
      });
      setConnectionStatus(res.ok ? 'ok' : 'fail');
    } catch {
      setConnectionStatus('fail');
    } finally {
      setTestingConnection(false);
    }
  }, [cdpUrl]);

  if (loading) return <div style={{ color: '#919191', fontSize: 13 }}>加载中...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 12 }}>{error}</div>
      )}
      {successMsg && (
        <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, color: '#4ade80', fontSize: 12 }}>{successMsg}</div>
      )}

      {/* CDP Connection */}
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={15} color="#e5e2e1" />
            CDP 连接
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>CDP URL</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={cdpUrl}
                onChange={e => { setCdpUrl(e.target.value); setConnectionStatus('idle'); }}
                placeholder="http://127.0.0.1:9222"
                style={{
                  flex: 1, background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 12,
                  fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                }}
              />
              <DarkButton
                label="测试"
                icon={<RefreshCw size={11} />}
                onClick={testConnection}
                variant="outline"
                size="sm"
                disabled={testingConnection || !cdpUrl.trim()}
                loading={testingConnection}
              />
            </div>
            {connectionStatus === 'ok' && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#4ade80' }}>CDP 连接正常</div>
            )}
            {connectionStatus === 'fail' && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#ff6b6b' }}>无法连接到 CDP — 请确认浏览器已启动并开启了远程调试端口</div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>浏览器可执行文件</label>
            <input
              value={executablePath}
              onChange={e => setExecutablePath(e.target.value)}
              placeholder="自动检测或手动指定路径"
              style={{
                width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 12,
                fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ marginTop: 4, fontSize: 11, color: '#555' }}>
              自动检测顺序: Edge → Chrome → 系统默认浏览器
            </div>
          </div>
        </div>
      </DarkCard>

      {/* Launch Options */}
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 14 }}>启动选项</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow
            label="Attach Only"
            description="仅附加到已有浏览器实例，不自动启动"
            checked={attachOnly}
            onChange={setAttachOnly}
          />
          <ToggleRow
            label="Headless"
            description="无头模式运行（无可见窗口）"
            checked={headless}
            onChange={setHeadless}
          />
        </div>
      </DarkCard>

      {/* Advanced */}
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>高级选项</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
              <FolderOpen size={11} style={{ display: 'inline', marginRight: 4 }} />
              User Data 目录
            </label>
            <input
              value={userDataDir}
              onChange={e => setUserDataDir(e.target.value)}
              placeholder="使用默认 profile（留空）"
              style={{
                width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 12,
                fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>额外启动参数</label>
            <input
              value={extraArgs}
              onChange={e => setExtraArgs(e.target.value)}
              placeholder="--disable-gpu --no-sandbox（空格分隔）"
              style={{
                width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 12,
                fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </DarkCard>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <DarkButton
          label="保存配置"
          icon={<Save size={12} />}
          onClick={saveConfig}
          variant="primary"
          size="md"
          disabled={saving}
          loading={saving}
        />
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e5e2e1' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#919191', marginTop: 1 }}>{description}</div>
      </div>
      <div
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={() => onChange(!checked)}
      >
        {checked
          ? <Eye size={22} color="#4ade80" />
          : <EyeOff size={22} color="#555" />
        }
      </div>
    </div>
  );
}
