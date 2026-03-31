import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Settings, Server } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

interface FeishuAccount {
  appId: string;
  appSecret: string;
}

interface FeishuChannel {
  enabled?: boolean;
  defaultAccount?: string;
  default?: { groupPolicy?: string };
  accounts?: Record<string, FeishuAccount>;
}

interface TrixNativeAccount {
  serverUrl: string;
  adminToken: string;
  serviceToken?: string;
}

interface TrixNativeChannel {
  enabled?: boolean;
  defaultAccount?: string;
  accounts?: Record<string, TrixNativeAccount>;
}

interface ChannelsConfig {
  feishu?: FeishuChannel;
  'trix-native'?: TrixNativeChannel;
}

export function SettingsChannels(_props: SettingsSharedState) {
  const [config, setConfig] = useState<ChannelsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showFeishuAdd, setShowFeishuAdd] = useState(false);
  const [newAccountId, setNewAccountId] = useState('');
  const [newAppId, setNewAppId] = useState('');
  const [newAppSecret, setNewAppSecret] = useState('');

  // TRIX Native form
  const [trixServerUrl, setTrixServerUrl] = useState('');
  const [trixAdminToken, setTrixAdminToken] = useState('');
  const [trixServiceToken, setTrixServiceToken] = useState('');

  const loadConfig = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const result = await api.configReadSection('channels');
      if (result.success) {
        const cfg = result.data as ChannelsConfig;
        setConfig(cfg || {});
        const trix = cfg?.['trix-native']?.accounts?.['default'];
        if (trix) {
          setTrixServerUrl(trix.serverUrl || '');
          setTrixAdminToken(trix.adminToken || '');
          setTrixServiceToken(trix.serviceToken || '');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveConfig = useCallback(async (updated: ChannelsConfig) => {
    const api = window.electronAPI;
    if (!api) return false;
    setSaving(true);
    setError(null);
    try {
      const result = await api.configWriteSection('channels', updated);
      if (result.success) {
        setConfig(updated);
        setSuccessMsg('配置已保存');
        setTimeout(() => setSuccessMsg(null), 3000);
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
  }, []);

  const handleAddFeishuAccount = useCallback(async () => {
    if (!newAccountId.trim() || !newAppId.trim() || !newAppSecret.trim()) return;
    if (!config) return;
    const feishu = config.feishu || { enabled: true, defaultAccount: 'default' };
    const updated = {
      ...config,
      feishu: {
        ...feishu,
        accounts: {
          ...(feishu.accounts || {}),
          [newAccountId.trim()]: { appId: newAppId.trim(), appSecret: newAppSecret.trim() },
        },
      },
    };
    const ok = await saveConfig(updated);
    if (ok) {
      setNewAccountId('');
      setNewAppId('');
      setNewAppSecret('');
      setShowFeishuAdd(false);
    }
  }, [config, saveConfig, newAccountId, newAppId, newAppSecret]);

  const handleDeleteFeishuAccount = useCallback(async (id: string) => {
    if (!config?.feishu?.accounts) return;
    const updated = {
      ...config,
      feishu: {
        ...config.feishu,
        accounts: { ...config.feishu.accounts },
      },
    };
    delete updated.feishu!.accounts![id];
    await saveConfig(updated);
  }, [config, saveConfig]);

  const handleSaveTrixNative = useCallback(async () => {
    if (!config) return;
    const updated = {
      ...config,
      'trix-native': {
        ...(config['trix-native'] || { enabled: true, defaultAccount: 'default' }),
        accounts: {
          default: {
            serverUrl: trixServerUrl,
            adminToken: trixAdminToken,
            serviceToken: trixServiceToken,
          },
        },
      },
    };
    await saveConfig(updated);
  }, [config, saveConfig, trixServerUrl, trixAdminToken, trixServiceToken]);

  if (loading) return <div style={{ color: '#919191', fontSize: 13 }}>加载中...</div>;

  const feishuAccounts = config?.feishu?.accounts || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 12 }}>{error}</div>
      )}
      {successMsg && (
        <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, color: '#4ade80', fontSize: 12 }}>{successMsg}</div>
      )}

      {/* Feishu Accounts */}
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>飞书账号</div>
            <div style={{ fontSize: 12, color: '#919191', marginTop: 2 }}>{Object.keys(feishuAccounts).length} 个账号</div>
          </div>
          <DarkButton label="添加账号" icon={<Plus size={12} />} onClick={() => setShowFeishuAdd(true)} variant="primary" size="sm" />
        </div>

        {showFeishuAdd && (
          <div style={{ background: '#141414', borderRadius: 10, padding: 14, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#919191', display: 'block', marginBottom: 3 }}>账号 ID</label>
                <input value={newAccountId} onChange={e => setNewAccountId(e.target.value)} placeholder="例如 trix / worker"
                  style={{ width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#e5e2e1', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 11, color: '#919191', display: 'block', marginBottom: 3 }}>App ID</label>
                <input value={newAppId} onChange={e => setNewAppId(e.target.value)} placeholder="cli_..."
                  style={{ width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#e5e2e1', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#919191', display: 'block', marginBottom: 3 }}>App Secret</label>
              <input type="password" value={newAppSecret} onChange={e => setNewAppSecret(e.target.value)} placeholder="App Secret"
                style={{ width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#e5e2e1', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <DarkButton label="取消" onClick={() => setShowFeishuAdd(false)} variant="ghost" size="sm" />
              <DarkButton label="添加" icon={<Plus size={11} />} onClick={handleAddFeishuAccount} variant="primary" size="sm"
                disabled={!newAccountId.trim() || !newAppId.trim() || !newAppSecret.trim() || saving} loading={saving} />
            </div>
          </div>
        )}

        {Object.entries(feishuAccounts).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#555', fontSize: 12 }}>暂无账号</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(feishuAccounts).map(([id, acct]) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#141414', borderRadius: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#e5e2e1' }}>{id}</div>
                  <div style={{ fontSize: 11, color: '#919191', fontFamily: 'monospace', marginTop: 2 }}>AppID: {acct.appId}</div>
                </div>
                <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', color: '#919191' }}
                  onClick={() => handleDeleteFeishuAccount(id)} title="删除">
                  <Trash2 size={13} />
                </div>
              </div>
            ))}
          </div>
        )}
      </DarkCard>

      {/* TRIX Native Server */}
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Server size={16} color="#e5e2e1" />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>TRIX Native Server</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Server URL</label>
            <input value={trixServerUrl} onChange={e => setTrixServerUrl(e.target.value)} placeholder="https://trix.love"
              style={{ width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Admin Token</label>
            <input type="password" value={trixAdminToken} onChange={e => setTrixAdminToken(e.target.value)} placeholder="Admin Token"
              style={{ width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 12, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Service Token</label>
            <input type="password" value={trixServiceToken} onChange={e => setTrixServiceToken(e.target.value)} placeholder="Service Token（可选）"
              style={{ width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 12, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <DarkButton label="保存" icon={<Settings size={11} />} onClick={handleSaveTrixNative} variant="primary" size="sm" disabled={saving} loading={saving} />
          </div>
        </div>
      </DarkCard>
    </div>
  );
}
