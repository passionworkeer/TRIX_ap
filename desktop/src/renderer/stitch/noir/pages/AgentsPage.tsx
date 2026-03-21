import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, RefreshCw, Terminal,
  Zap, Cpu, ChevronRight,
} from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import { DarkTerminal, createLogEntry, type LogEntry } from '../components/DarkTerminal';

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
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.agents && Array.isArray(parsed.agents)) return parsed.agents;
  } catch {
    // fallback below
  }
  const lines = output.split('\n').filter(Boolean);
  return lines
    .map((line, i) => {
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

const AGENT_COLORS = [
  { bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.25)', icon: '#818cf8' },
  { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.25)', icon: '#f472b6' },
  { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.25)', icon: '#34d399' },
  { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.25)', icon: '#fbbf24' },
  { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.25)', icon: '#60a5fa' },
  { bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.25)', icon: '#a78bfa' },
];

type DetailTab = 'info' | 'capabilities' | 'tools';

const AgentAvatar = ({ index }: { index: number }) => {
  const color = AGENT_COLORS[index % AGENT_COLORS.length]!;
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: color.bg,
        border: `1px solid ${color.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Bot size={18} color={color.icon} />
    </div>
  );
};

const TabButton = ({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '5px 12px',
      borderRadius: 6,
      border: 'none',
      background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
      color: active ? '#e5e2e1' : '#919191',
      fontSize: 12,
      fontWeight: active ? 600 : 500,
      cursor: 'pointer',
      transition: 'all 0.15s',
      fontFamily: 'system-ui, sans-serif',
    }}
    onMouseEnter={(e) => {
      if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
    }}
    onMouseLeave={(e) => {
      if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
    }}
  >
    <Icon size={13} />
    {label}
  </button>
);

const AgentTool = ({ name }: { name: string }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 6,
      fontSize: 12,
      color: '#c6c6c6',
      fontFamily: 'system-ui, sans-serif',
    }}
  >
    <Terminal size={11} color="#919191" />
    {name}
  </div>
);

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('info');

  const addLog = (entry: LogEntry) =>
    setLogEntries((prev) => [...prev.slice(-99), entry]);

  const loadAgents = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const result: CommandResult = await api.listAgents();
      const output = result.stdout || result.stderr || result.error || '无输出';
      const parsed = parseAgentsOutput(output);
      setAgents(parsed);
      if (parsed.length > 0 && !selectedAgent) {
        setSelectedAgent(parsed[0]!);
      }
      if (parsed.length === 0) {
        addLog(createLogEntry('warning', '未检测到 Agent，请先安装 OpenClaw'));
      } else {
        addLog(createLogEntry('success', `已加载 ${parsed.length} 个 Agent`));
      }
    } catch (err) {
      addLog(createLogEntry('error', `加载失败: ${String(err)}`));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#131313',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 28px 16px',
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#e5e2e1',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Agent 管理
          </h1>
          <p style={{ fontSize: 12, color: '#919191', margin: '4px 0 0' }}>
            {agents.length > 0 ? `共 ${agents.length} 个 Agent` : '加载中...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <DarkButton
            icon={<RefreshCw size={13} />}
            label="刷新"
            onClick={loadAgents}
            variant="outline"
            size="md"
          />
        </div>
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '0 28px 16px', gap: 16 }}>
        {/* Agent list */}
        <div
          style={{
            width: 240,
            flexShrink: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#919191', fontSize: 13 }}>
              加载中...
            </div>
          ) : agents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#919191', fontSize: 13 }}>
              未检测到 Agent
            </div>
          ) : (
            agents.map((agent, i) => {
              const isActive = selectedAgent?.id === agent.id;
              return (
                <button
                  key={agent.id}
                  onClick={() => { setSelectedAgent(agent); setActiveTab('info'); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: isActive ? 'rgba(129,140,248,0.1)' : 'rgba(255,255,255,0.02)',
                    borderColor: isActive ? 'rgba(129,140,248,0.2)' : 'transparent',
                    borderStyle: 'solid',
                    borderWidth: 1,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)';
                  }}
                >
                  <AgentAvatar index={i} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isActive ? '#818cf8' : '#e5e2e1',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {agent.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#919191',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {agent.model || agent.status || '—'}
                    </div>
                  </div>
                  {isActive && <ChevronRight size={13} color="#818cf8" />}
                </button>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {selectedAgent ? (
            <>
              <DarkCard elevation="low" style={{ padding: '16px 18px' }}>
                {/* Agent header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <AgentAvatar index={agents.indexOf(selectedAgent)} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#e5e2e1' }}>
                      {selectedAgent.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#919191', marginTop: 2 }}>
                      {selectedAgent.model || '—'} ·{' '}
                      <span
                        style={{
                          color: selectedAgent.status === 'running' ? '#4ade80' : '#ff6b6b',
                        }}
                      >
                        {selectedAgent.status === 'running' ? '运行中' : '已停止'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div
                  style={{
                    display: 'flex',
                    gap: 2,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: 14,
                  }}
                >
                  {[
                    { key: 'info' as DetailTab, label: '基本信息', icon: Cpu },
                    { key: 'capabilities' as DetailTab, label: '能力', icon: Zap },
                    { key: 'tools' as DetailTab, label: '工具', icon: Terminal },
                  ].map((tab) => (
                    <TabButton
                      key={tab.key}
                      active={activeTab === tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      label={tab.label}
                      icon={tab.icon}
                    />
                  ))}
                </div>

                {/* Tab content */}
                {activeTab === 'info' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Agent ID', value: selectedAgent.id },
                      { label: '模型', value: selectedAgent.model || '未指定' },
                      { label: '状态', value: selectedAgent.status || '未知' },
                      { label: '描述', value: selectedAgent.description || '无描述' },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          gap: 12,
                          fontSize: 12,
                        }}
                      >
                        <span style={{ color: '#919191', width: 60, flexShrink: 0 }}>{label}</span>
                        <span style={{ color: '#c6c6c6' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'capabilities' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {['图像生成', '语音合成', 'RAG 检索', '代码执行'].map((cap) => (
                      <div
                        key={cap}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          color: '#c6c6c6',
                        }}
                      >
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#4ade80',
                          }}
                        />
                        {cap}
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'tools' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(selectedAgent.tools || ['web_search', 'code_interpreter', 'file_system']).map((tool) => (
                      <AgentTool key={tool} name={tool} />
                    ))}
                  </div>
                )}
              </DarkCard>

              {/* Terminal */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <DarkTerminal entries={logEntries} autoScroll maxEntries={150} />
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#919191',
                fontSize: 13,
              }}
            >
              选择一个 Agent 查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
