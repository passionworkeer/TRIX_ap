import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

interface PluginEntry {
  enabled?: boolean;
}

interface PluginsConfig {
  load?: { paths?: string[] };
  entries?: Record<string, PluginEntry>;
}

export function SettingsPlugins(_props: SettingsSharedState) {
  const [config, setConfig] = useState<PluginsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [newPath, setNewPath] = useState('');
  const [entryToggles, setEntryToggles] = useState<Record<string, boolean>>({});

  const loadConfig = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const result = await api.configReadSection('plugins');
      if (result.success) {
        const cfg = result.data as PluginsConfig;
        setConfig(cfg || {});
        const entries = cfg?.entries || {};
        setEntryToggles(Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, !!v.enabled])));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const saveConfig = useCallback(async (updated: PluginsConfig) => {
    const api = window.electronAPI;
    if (!api) return false;
    setSaving(true);
    setError(null);
    try {
      // Merge toggles into entries
      const entries: Record<string, PluginEntry> = {};
      for (const [k, v] of Object.entries(config?.entries || {})) {
        entries[k] = { enabled: entryToggles[k] ?? v.enabled };
      }
      const toSave = { ...updated, entries };
      const result = await api.configWriteSection('plugins', toSave);
      if (result.success) {
        setConfig(toSave);
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
  }, [config, entryToggles]);

  const paths = config?.load?.paths || [];

  const handleAddPath = useCallback(() => {
    if (!newPath.trim() || paths.includes(newPath.trim())) return;
    const updated = { ...config, load: { paths: [...paths, newPath.trim()] } };
    saveConfig(updated);
    setNewPath('');
  }, [config, paths, newPath, saveConfig]);

  const handleRemovePath = useCallback((path: string) => {
    if (!config) return;
    const updated = { ...config, load: { paths: paths.filter(p => p !== path) } };
    saveConfig(updated);
  }, [config, paths, saveConfig]);

  const handleToggleEntry = useCallback((id: string, enabled: boolean) => {
    setEntryToggles(prev => ({ ...prev, [id]: enabled }));
  }, []);

  const handleSaveEntries = useCallback(async () => {
    await saveConfig(config || {});
  }, [config, saveConfig]);

  if (loading) return <div style={{ color: '#919191', fontSize: 13 }}>加载中...</div>;

  const entryDefs: { id: string; name: string; desc: string }[] = [
    { id: 'feishu', name: '飞书', desc: '飞书频道集成' },
    { id: 'trix-native', name: 'TRIX Native', desc: 'TRIX 原生通道' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 12 }}>{error}</div>
      )}
      {successMsg && (
        <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, color: '#4ade80', fontSize: 12 }}>{successMsg}</div>
      )}

      {/* Plugin Entries (enable/disable) */}
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>插件启停</div>
          <DarkButton label="保存" icon={<Save size={11} />} onClick={handleSaveEntries} variant="primary" size="sm" disabled={saving} loading={saving} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entryDefs.map(({ id, name, desc }) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#141414', borderRadius: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#e5e2e1' }}>{name}</div>
                <div style={{ fontSize: 11, color: '#919191', marginTop: 1 }}>{desc}</div>
              </div>
              <div
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                onClick={() => handleToggleEntry(id, !entryToggles[id])}
                title={entryToggles[id] ? '点击禁用' : '点击启用'}
              >
                {entryToggles[id]
                  ? <ToggleRight size={26} color="#4ade80" />
                  : <ToggleLeft size={26} color="#555" />
                }
              </div>
            </div>
          ))}
        </div>
      </DarkCard>

      {/* Plugin Paths */}
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>插件路径</div>
            <div style={{ fontSize: 12, color: '#919191', marginTop: 2 }}>{paths.length} 个路径</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {paths.map(p => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#141414', borderRadius: 8 }}>
              <div style={{ flex: 1, fontSize: 12, color: '#e5e2e1', fontFamily: 'monospace', wordBreak: 'break-all' }}>{p}</div>
              <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', color: '#919191', flexShrink: 0 }}
                onClick={() => handleRemovePath(p)} title="删除路径">
                <Trash2 size={13} />
              </div>
            </div>
          ))}
          {paths.length === 0 && (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#555', fontSize: 12 }}>暂无自定义路径</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newPath}
            onChange={e => setNewPath(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPath()}
            placeholder="输入插件目录路径"
            style={{ flex: 1, background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#e5e2e1', fontSize: 12, outline: 'none' }}
          />
          <DarkButton label="添加" icon={<Plus size={11} />} onClick={handleAddPath} variant="outline" size="sm" disabled={!newPath.trim() || saving} />
        </div>
      </DarkCard>
    </div>
  );
}
