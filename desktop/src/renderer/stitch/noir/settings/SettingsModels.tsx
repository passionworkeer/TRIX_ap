import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

interface ModelDef {
  id: string;
  name: string;
  api?: string;
  reasoning?: boolean;
  input: string[];
  cost?: { input: number; output: number; cacheRead?: number; cacheWrite?: number };
  contextWindow?: number;
  maxTokens?: number;
}

interface ProviderDef {
  baseUrl: string;
  api: string;
  authHeader?: boolean;
  models: ModelDef[];
}

interface ModelsConfig {
  mode?: string;
  providers?: Record<string, ProviderDef>;
}

export function SettingsModels(_props: SettingsSharedState) {
  const [config, setConfig] = useState<ModelsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addProvider, setAddProvider] = useState(false);

  // New provider form state
  const [newProviderId, setNewProviderId] = useState('');
  const [newProviderUrl, setNewProviderUrl] = useState('');
  const [newProviderApi, setNewProviderApi] = useState('anthropic-messages');

  const loadModels = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.configReadSection('models');
      if (result.success) {
        setConfig((result.data as ModelsConfig) || { providers: {} });
      } else {
        setError(result.error || '加载失败');
        setConfig({ providers: {} });
      }
    } catch {
      setError('加载失败');
      setConfig({ providers: {} });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  const saveConfig = useCallback(async (updated: ModelsConfig) => {
    const api = window.electronAPI;
    if (!api) return false;
    setSaving(true);
    try {
      const result = await api.configWriteSection('models', updated);
      if (result.success) {
        setConfig(updated);
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

  const handleDeleteProvider = useCallback(async (providerId: string) => {
    if (!config) return;
    if (!confirm(`确认删除 Provider "${providerId}"？`)) return;
    const updated = { ...config, providers: { ...config.providers } };
    delete updated.providers![providerId];
    const ok = await saveConfig(updated);
    if (ok) {
      const next = { ...expanded };
      delete next[providerId];
      setExpanded(next);
    }
  }, [config, saveConfig, expanded]);

  const handleAddProvider = useCallback(async () => {
    if (!newProviderId.trim() || !newProviderUrl.trim()) return;
    if (!config) return;
    const updated = {
      ...config,
      providers: {
        ...config.providers,
        [newProviderId.trim()]: {
          baseUrl: newProviderUrl.trim(),
          api: newProviderApi,
          authHeader: true,
          models: [],
        },
      },
    };
    const ok = await saveConfig(updated);
    if (ok) {
      setNewProviderId('');
      setNewProviderUrl('');
      setNewProviderApi('anthropic-messages');
      setAddProvider(false);
    }
  }, [config, saveConfig, newProviderId, newProviderUrl, newProviderApi]);

  const handleAddModel = useCallback(async (providerId: string) => {
    if (!config?.providers?.[providerId]) return;
    const provider = config.providers[providerId];
    const newModel: ModelDef = {
      id: 'new-model',
      name: 'New Model',
      api: provider.api,
      input: ['text'],
      contextWindow: 128000,
      maxTokens: 4096,
      cost: { input: 0, output: 0 },
    };
    const updated = {
      ...config,
      providers: {
        ...config.providers,
        [providerId]: {
          ...provider,
          models: [...provider.models, newModel],
        },
      },
    };
    await saveConfig(updated);
  }, [config, saveConfig]);

  const handleDeleteModel = useCallback(async (providerId: string, modelId: string) => {
    if (!config?.providers?.[providerId]) return;
    const provider = config.providers[providerId];
    const updated = {
      ...config,
      providers: {
        ...config.providers,
        [providerId]: {
          ...provider,
          models: provider.models.filter(m => m.id !== modelId),
        },
      },
    };
    await saveConfig(updated);
  }, [config, saveConfig]);

  const handleUpdateModel = useCallback(async (providerId: string, modelId: string, patch: Partial<ModelDef>) => {
    if (!config?.providers?.[providerId]) return;
    const provider = config.providers[providerId];
    const updated = {
      ...config,
      providers: {
        ...config.providers,
        [providerId]: {
          ...provider,
          models: provider.models.map(m => m.id === modelId ? { ...m, ...patch } : m),
        },
      },
    };
    await saveConfig(updated);
  }, [config, saveConfig]);

  if (loading) {
    return <div style={{ color: '#919191', fontSize: 13 }}>加载中...</div>;
  }

  const providers = config?.providers || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>模型 Provider</div>
          <div style={{ fontSize: 12, color: '#919191', marginTop: 2 }}>
            {Object.keys(providers).length} 个 Provider，共 {Object.values(providers).reduce((n, p) => n + (p.models?.length || 0), 0)} 个模型
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <DarkButton label="刷新" onClick={loadModels} variant="outline" size="sm" />
          <DarkButton label="添加 Provider" icon={<Plus size={12} />} onClick={() => setAddProvider(true)} variant="primary" size="sm" disabled={saving} />
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 10, color: '#ff6b6b', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Add Provider Form */}
      {addProvider && (
        <DarkCard elevation="low">
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>添加新 Provider</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#919191', width: 70, flexShrink: 0 }}>Provider ID</label>
              <input
                value={newProviderId}
                onChange={e => setNewProviderId(e.target.value)}
                placeholder="例如 openai / anthropic"
                style={{ flex: 1, background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#e5e2e1', fontSize: 12, outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#919191', width: 70, flexShrink: 0 }}>Base URL</label>
              <input
                value={newProviderUrl}
                onChange={e => setNewProviderUrl(e.target.value)}
                placeholder="https://api.example.com/v1"
                style={{ flex: 1, background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#e5e2e1', fontSize: 12, outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: '#919191', width: 70, flexShrink: 0 }}>API 类型</label>
              <select
                value={newProviderApi}
                onChange={e => setNewProviderApi(e.target.value)}
                style={{ flex: 1, background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', color: '#e5e2e1', fontSize: 12, outline: 'none' }}
              >
                <option value="anthropic-messages">anthropic-messages</option>
                <option value="openai-chat">openai-chat</option>
                <option value="openai-responses">openai-responses</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <DarkButton label="取消" onClick={() => setAddProvider(false)} variant="ghost" size="sm" />
              <DarkButton label="确认添加" icon={<Check size={12} />} onClick={handleAddProvider} variant="primary" size="sm" disabled={!newProviderId.trim() || !newProviderUrl.trim() || saving} loading={saving} />
            </div>
          </div>
        </DarkCard>
      )}

      {/* Provider List */}
      {Object.keys(providers).length === 0 ? (
        <DarkCard elevation="low">
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#919191', fontSize: 13 }}>
            暂无 Provider，点击「添加 Provider」开始配置
          </div>
        </DarkCard>
      ) : (
        Object.entries(providers).map(([providerId, provider]) => (
          <DarkCard key={providerId} elevation="low">
            {/* Provider Header */}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setExpanded(prev => ({ ...prev, [providerId]: !prev[providerId] }))}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ color: expanded[providerId] ? '#e5e2e1' : '#919191' }}>
                  {expanded[providerId] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1' }}>{providerId}</div>
                  <div style={{ fontSize: 11, color: '#919191', marginTop: 1 }}>{provider.baseUrl}</div>
                </div>
                <div style={{ marginLeft: 8, padding: '2px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: 6, fontSize: 11, color: '#919191' }}>
                  {provider.models?.length || 0} 模型
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <div
                  style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', color: '#919191' }}
                  title="删除 Provider"
                  onClick={e => { e.stopPropagation(); handleDeleteProvider(providerId); }}
                >
                  <Trash2 size={13} />
                </div>
              </div>
            </div>

            {/* Models List */}
            {expanded[providerId] && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(provider.models || []).map(model => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    onUpdate={patch => handleUpdateModel(providerId, model.id, patch)}
                    onDelete={() => handleDeleteModel(providerId, model.id)}
                  />
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <DarkButton
                    label="添加模型"
                    icon={<Plus size={11} />}
                    onClick={() => handleAddModel(providerId)}
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                  />
                </div>
              </div>
            )}
          </DarkCard>
        ))
      )}
    </div>
  );
}

// ── Model Row (inline editable) ──────────────────────────────────────────────

interface ModelRowProps {
  model: ModelDef;
  onUpdate: (patch: Partial<ModelDef>) => void;
  onDelete: () => void;
}

function ModelRow({ model, onUpdate, onDelete }: ModelRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ModelDef>(model);

  const apply = () => {
    onUpdate(draft);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(model);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ background: '#141414', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Model ID" value={draft.id} onChange={v => setDraft(d => ({ ...d, id: v }))} />
          <Field label="显示名称" value={draft.name} onChange={v => setDraft(d => ({ ...d, name: v }))} />
          <Field label="Context Window" value={String(draft.contextWindow || 0)} onChange={v => setDraft(d => ({ ...d, contextWindow: parseInt(v) || 0 }))} type="number" />
          <Field label="Max Tokens" value={String(draft.maxTokens || 0)} onChange={v => setDraft(d => ({ ...d, maxTokens: parseInt(v) || 0 }))} type="number" />
          <Field label="输入价格 ($/1M)" value={String(draft.cost?.input || 0)} onChange={v => setDraft(d => ({ ...d, cost: { ...d.cost ?? { input: 0, output: 0 }, input: parseFloat(v) || 0 } } as ModelDef))} type="number" />
          <Field label="输出价格 ($/1M)" value={String(draft.cost?.output || 0)} onChange={v => setDraft(d => ({ ...d, cost: { ...d.cost ?? { input: 0, output: 0 }, output: parseFloat(v) || 0 } } as ModelDef))} type="number" />
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <DarkButton label="取消" onClick={cancel} variant="ghost" size="sm" />
          <DarkButton label="保存" icon={<Check size={11} />} onClick={apply} variant="primary" size="sm" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#141414', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e2e1' }}>{model.name || model.id}</div>
        <div style={{ fontSize: 11, color: '#919191', marginTop: 2 }}>
          {model.id} · {model.contextWindow?.toLocaleString()} ctx · ${model.cost?.input}/M in · ${model.cost?.output}/M out
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', color: '#919191' }} onClick={() => setEditing(true)} title="编辑"><Edit2 size={12} /></div>
        <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', color: '#919191' }} onClick={onDelete} title="删除"><Trash2 size={12} /></div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
}

function Field({ label, value, onChange, type = 'text' }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 10, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: '#e5e2e1', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' }}
      />
    </div>
  );
}
