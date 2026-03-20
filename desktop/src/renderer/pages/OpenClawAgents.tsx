import React, { useState, useEffect, useCallback } from 'react';
import { Bot, Cpu, Globe, FileText, Zap, Clock, RefreshCw, ChevronRight, Shield, Terminal, List, Plus, Minus } from 'lucide-react';

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

interface Agent {
  id: string;
  name: string;
  model?: string;
  status?: string;
  description?: string;
  tools?: string[];
}

function parseAgentsOutput(output: string): Agent[] {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.agents && Array.isArray(parsed.agents)) return parsed.agents;
  } catch {
    // Not JSON - try line-by-line parsing
  }
  // Fallback: try to extract agent names from text output
  const lines = output.split('\n').filter(Boolean);
  return lines
    .map((line, i) => {
      // Try to extract agent info from line
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 1) {
        return {
          id: String(i),
          name: parts[0].replace(/^[*\-+•]/, ''),
          model: parts[1] || 'Unknown',
          status: line.toLowerCase().includes('running') ? 'running' : 'stopped',
        };
      }
      return null;
    })
    .filter(Boolean) as Agent[];
}

const AGENT_DEFAULT_AVATARS = [
  { bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)', emoji: '🤖' },
  { bg: 'linear-gradient(135deg, #ec4899, #f43f5e)', emoji: '🦊' },
  { bg: 'linear-gradient(135deg, #10b981, #059669)', emoji: '🐉' },
  { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', emoji: '🦅' },
  { bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', emoji: '🔮' },
  { bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', emoji: '🌙' },
];

type DetailTab = 'info' | 'capabilities' | 'skills' | 'automations';

function AgentAvatar({ name, index }: { name: string; index: number }) {
  const avatar = AGENT_DEFAULT_AVATARS[index % AGENT_DEFAULT_AVATARS.length];
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: avatar.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {avatar.emoji}
    </div>
  );
}

function AgentCard({ agent, isActive, onClick, index }: { agent: Agent; isActive: boolean; onClick: () => void; index: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        border: 'none',
        background: isActive ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
        borderColor: isActive ? 'rgba(99,102,241,0.3)' : 'transparent',
        borderStyle: 'solid',
        borderWidth: 1,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      <AgentAvatar name={agent.name} index={index} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#818cf8' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.name}
        </div>
        <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {agent.model || agent.status || '—'}
        </div>
      </div>
      {isActive && <ChevronRight size={14} color="#818cf8" />}
    </button>
  );
}

function ToolToggle({ name, enabled }: { name: string; enabled: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Terminal size={13} color="#64748b" />
        <span style={{ fontSize: 13, color: '#94a3b8' }}>{name}</span>
      </div>
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: enabled ? '#6366f1' : 'rgba(255,255,255,0.1)',
          position: 'relative',
          transition: 'background 0.2s',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: enabled ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
          }}
        />
      </div>
    </div>
  );
}

export default function OpenClawAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawOutput, setRawOutput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const [cmdLoading, setCmdLoading] = useState(false);

  const loadAgents = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const result: CommandResult = await api.listAgents();
      setRawOutput(result.stdout || result.stderr || result.error || '无输出');
      const parsed = parseAgentsOutput(result.stdout || result.stderr);
      setAgents(parsed);
      if (parsed.length > 0 && !selectedAgent) {
        setSelectedAgent(parsed[0]);
      }
    } catch (err) {
      setRawOutput(`错误: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const runCommand = async (cmd: string) => {
    const api = window.electronAPI;
    if (!api) return;
    setCmdLoading(true);
    try {
      const result: CommandResult = await api.runOpenClawCommand(cmd);
      setRawOutput(result.stdout || result.stderr || result.error || '无输出');
      // Refresh agent list after command
      await loadAgents();
    } catch (err) {
      setRawOutput(`错误: ${String(err)}`);
    } finally {
      setCmdLoading(false);
    }
  };

  const tabs: { id: DetailTab; label: string; icon: React.ElementType }[] = [
    { id: 'info', label: '基本信息', icon: FileText },
    { id: 'capabilities', label: '能力配置', icon: Cpu },
    { id: 'skills', label: 'Skills', icon: Zap },
    { id: 'automations', label: '自动化', icon: Clock },
  ];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        background: 'var(--bg-primary)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Left: Fleet Sidebar */}
      <div
        style={{
          width: 260,
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={16} color="#818cf8" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Agent Fleet</span>
            </div>
            <button
              onClick={loadAgents}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: 6,
                color: '#64748b',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={11} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              刷新
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {agents.length} 个 Agent
          </div>
        </div>

        {/* Agent List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 12 }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
              加载中...
            </div>
          ) : agents.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 12 }}>
              未找到 Agent
            </div>
          ) : (
            agents.map((agent, i) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isActive={selectedAgent?.id === agent.id}
                onClick={() => setSelectedAgent(agent)}
                index={i}
              />
            ))
          )}
        </div>

        {/* Create button */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <button
            disabled
            title="通过 CLI 创建: openclaw agents create <name>"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px',
              borderRadius: 10,
              border: '1px dashed rgba(255,255,255,0.1)',
              background: 'rgba(99,102,241,0.05)',
              color: '#6366f1',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'not-allowed',
              opacity: 0.6,
            }}
          >
            <Plus size={14} />
            新建 Agent（需 CLI）
          </button>
        </div>
      </div>

      {/* Right: Agent Detail */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!selectedAgent ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <Bot size={48} color="#1e293b" />
            <p style={{ color: '#334155', fontSize: 14 }}>选择左侧 Agent 查看详情</p>
          </div>
        ) : (
          <>
            {/* Agent Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexShrink: 0,
              }}
            >
              <AgentAvatar name={selectedAgent.name} index={agents.indexOf(selectedAgent)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{selectedAgent.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {selectedAgent.model ? `模型: ${selectedAgent.model}` : selectedAgent.status ? `状态: ${selectedAgent.status}` : 'Agent 配置'}
                </div>
              </div>
              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: selectedAgent.status === 'running' ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                  color: selectedAgent.status === 'running' ? '#22c55e' : '#64748b',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {selectedAgent.status || '未知'}
              </div>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                padding: '0 20px',
                flexShrink: 0,
              }}
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 14px',
                    border: 'none',
                    background: 'transparent',
                    color: activeTab === tab.id ? '#818cf8' : '#64748b',
                    fontSize: 13,
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    cursor: 'pointer',
                    borderBottom: `2px solid ${activeTab === tab.id ? '#818cf8' : 'transparent'}`,
                    marginBottom: -1,
                    transition: 'all 0.15s',
                  }}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {activeTab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      padding: '16px',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent 标识</div>
                    <div style={{ fontSize: 14, color: '#e2e8f0', fontFamily: 'ui-monospace, monospace' }}>{selectedAgent.id}</div>
                  </div>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      padding: '16px',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>模型</div>
                    <div style={{ fontSize: 14, color: '#e2e8f0' }}>{selectedAgent.model || '未指定'}</div>
                  </div>
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      padding: '16px',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>原始输出</div>
                    <pre
                      style={{
                        fontSize: 11,
                        color: '#94a3b8',
                        fontFamily: 'ui-monospace, monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        margin: 0,
                        maxHeight: 200,
                        overflowY: 'auto',
                      }}
                    >
                      {rawOutput || '无原始输出'}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'capabilities' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                    通过 Gateway CLI 配置 agent 能力，或在 OpenClaw Studio 中交互式管理
                  </div>
                  <ToolToggle name="命令执行 (Commands)" enabled={true} />
                  <ToolToggle name="Web 访问" enabled={true} />
                  <ToolToggle name="文件工具" enabled={true} />
                  <ToolToggle name="浏览器自动化" enabled={false} />
                  <ToolToggle name="安全沙箱" enabled={true} />
                  <div style={{ marginTop: 12 }}>
                    <button
                      onClick={() => runCommand('agents list')}
                      disabled={cmdLoading}
                      style={{
                        padding: '8px 14px',
                        background: 'rgba(99,102,241,0.1)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 8,
                        color: '#818cf8',
                        fontSize: 13,
                        cursor: cmdLoading ? 'not-allowed' : 'pointer',
                        opacity: cmdLoading ? 0.5 : 1,
                      }}
                    >
                      {cmdLoading ? '执行中...' : '刷新配置'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'skills' && (
                <div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                    通过 CLI 安装 Skill: <code style={{ color: '#818cf8', fontFamily: 'ui-monospace' }}>openclaw skills install &lt;name&gt;</code>
                  </div>
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: 10,
                      padding: '20px',
                      textAlign: 'center',
                    }}
                  >
                    <Zap size={28} color="#334155" style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, color: '#475569' }}>在「桌面设置」中使用 Skill 管理功能</p>
                  </div>
                </div>
              )}

              {activeTab === 'automations' && (
                <div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                    使用 <code style={{ color: '#818cf8', fontFamily: 'ui-monospace' }}>openclaw cron</code> CLI 命令配置定时任务
                  </div>
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: 10,
                      padding: '20px',
                      textAlign: 'center',
                    }}
                  >
                    <Clock size={28} color="#334155" style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 13, color: '#475569' }}>定时任务和自动化脚本</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
