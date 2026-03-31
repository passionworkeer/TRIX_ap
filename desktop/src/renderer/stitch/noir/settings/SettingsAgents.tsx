import { useState, useEffect, useCallback } from 'react';
import os from 'node:os';
import path from 'node:path';
import { Bot, Save, ChevronDown, ChevronRight, RefreshCw, CheckCircle } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

interface AgentsConfig {
  defaults?: {
    model?: { primary?: string };
    models?: Record<string, { alias?: string }>;
    workspace?: string;
    compaction?: { mode?: string };
  };
  list?: AgentDef[];
}

interface AgentDef {
  id?: string;
  name?: string;
  groupChat?: { mentionPatterns?: string[] };
}

export function SettingsAgents(_props: SettingsSharedState) {
  const [config, setConfig] = useState<AgentsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [openAgents, setOpenAgents] = useState<AgentDef[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Draft form state
  const [primaryModel, setPrimaryModel] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [compactionMode, setCompactionMode] = useState('safeguard');

  const loadConfig = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const result = await api.configReadSection('agents');
      if (result.success) {
        const cfg = result.data as AgentsConfig;
        setConfig(cfg || {});
        setPrimaryModel(cfg?.defaults?.model?.primary || '');
        setWorkspace(cfg?.defaults?.workspace || '');
        setCompactionMode(cfg?.defaults?.compaction?.mode || 'safeguard');
        setOpenAgents(cfg?.list || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const loadOpenClawAgents = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoadingAgents(true);
    try {
      const result = await api.listAgents();
      // Agents are listed via CLI output, not config
      if (result.success && result.stdout) {
        try {
          const parsed = JSON.parse(result.stdout);
          const agents = Array.isArray(parsed) ? parsed : (parsed.agents || []);
          setOpenAgents(agents as AgentDef[]);
        } catch {
          // non-JSON output — keep config-based list
        }
      }
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  const saveConfig = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setSaving(true);
    setError(null);
    try {
      const updated: AgentsConfig = {
        ...config,
        defaults: {
          model: { primary: primaryModel },
          workspace,
          compaction: { mode: compactionMode },
        },
        list: openAgents,
      };
      const result = await api.configWriteSection('agents', updated);
      if (result.success) {
        setConfig(updated);
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
  }, [config, primaryModel, workspace, compactionMode, openAgents]);

  const toggleAgent = useCallback((id: string) => {
    setExpandedAgent(prev => prev === id ? null : id);
  }, []);

  const updateAgentMention = useCallback((id: string, pattern: string) => {
    setOpenAgents(prev => prev.map(a => {
      if (a.id !== id) return a;
      const existing = a.groupChat?.mentionPatterns || [];
      const has = existing.includes(pattern);
      return {
        ...a,
        groupChat: {
          mentionPatterns: has
            ? existing.filter(p => p !== pattern)
            : [...existing, pattern],
        },
      };
    }));
  }, []);

  const MODEL_ALIASES: Record<string, string> = {
    'minimax-cn/MiniMax-M2.5': 'Minimax M2.5',
    'minimax-cn/MiniMax-M2.7': 'Minimax M2.7',
  };

  if (loading) return <div style={{ color: '#919191', fontSize: 13 }}>加载中...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 12 }}>{error}</div>
      )}
      {successMsg && (
        <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, color: '#4ade80', fontSize: 12 }}>{successMsg}</div>
      )}

      {/* Default Model */}
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>默认模型</div>
          <DarkButton
            label={loadingAgents ? '刷新' : '扫描 Agents'}
            icon={<RefreshCw size={11} />}
            onClick={loadOpenClawAgents}
            variant="ghost"
            size="sm"
            disabled={loadingAgents}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>主模型</label>
            <select
              value={primaryModel}
              onChange={e => setPrimaryModel(e.target.value)}
              style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
            >
              <option value="">选择默认模型</option>
              <option value="minimax-cn/MiniMax-M2.5">MiniMax M2.5</option>
              <option value="minimax-cn/MiniMax-M2.7">MiniMax M2.7</option>
            </select>
            {primaryModel && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#555' }}>
                {MODEL_ALIASES[primaryModel] || primaryModel}
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#919191', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Compaction 模式</label>
            <select
              value={compactionMode}
              onChange={e => setCompactionMode(e.target.value)}
              style={{ background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
            >
              <option value="safeguard">safeguard（安全模式）</option>
              <option value="aggressive">aggressive（激进压缩）</option>
              <option value="off">off（关闭）</option>
            </select>
          </div>
        </div>
      </DarkCard>

      {/* Workspace */}
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>工作区</div>
        <div>
          <input
            value={workspace}
            onChange={e => setWorkspace(e.target.value)}
            placeholder={`${os.homedir()}${path.sep}.openclaw${path.sep}workspace`}
            style={{
              width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '7px 10px', color: '#e5e2e1', fontSize: 12,
              fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: 4, fontSize: 11, color: '#555' }}>Agent 工作目录，存储会话和缓存</div>
        </div>
      </DarkCard>

      {/* Agent List */}
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
          Agent 列表
          <span style={{ fontSize: 12, fontWeight: 400, color: '#919191', marginLeft: 8 }}>
            {openAgents.length} 个
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {openAgents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#555', fontSize: 12 }}>
              暂无 Agent — 请先安装 OpenClaw
            </div>
          ) : openAgents.map((agent, i) => {
            const isOpen = expandedAgent === agent.id;
            const patterns = agent.groupChat?.mentionPatterns || [];
            return (
              <div key={agent.id || i} style={{ background: '#141414', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  onClick={() => agent.id && toggleAgent(agent.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    background: 'transparent', border: 'none', cursor: agent.id ? 'pointer' : 'default',
                    textAlign: 'left', color: '#e5e2e1',
                  }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bot size={14} color="#818cf8" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{agent.name || agent.id || '(未命名)'}</div>
                    <div style={{ fontSize: 11, color: '#919191', marginTop: 1 }}>
                      {patterns.length > 0 ? `唤醒词: ${patterns.join(', ')}` : '无唤醒词'}
                    </div>
                  </div>
                  {agent.id && (isOpen ? <ChevronDown size={14} color="#919191" /> : <ChevronRight size={14} color="#919191" />)}
                </button>
                {isOpen && (
                  <div style={{ padding: '0 14px 12px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ paddingTop: 10 }}>
                      <div style={{ fontSize: 11, color: '#919191', marginBottom: 8 }}>唤醒模式</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {['@trix', '@TRIX', '@openclaw'].map(p => {
                          const active = patterns.includes(p);
                          return (
                            <div
                              key={p}
                              onClick={() => agent.id && updateAgentMention(agent.id, p)}
                              style={{
                                padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                                background: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
                                color: active ? '#818cf8' : '#919191',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              {active && <CheckCircle size={10} color="#818cf8" />}
                              {p}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
