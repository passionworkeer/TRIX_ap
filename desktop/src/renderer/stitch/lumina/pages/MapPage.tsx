import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Plus, Minus, Crosshair, Layers, X } from 'lucide-react';

// Deterministic position hash — maps agent name to a pseudo-random spot on the map
function hashPosition(name: string): { x: string; y: string } {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const x = 15 + ((Math.abs(h) % 70));
  const y = 15 + ((Math.abs(h * 31) % 65));
  return { x: `${x}%`, y: `${y}%` };
}

function parseAgentsOutput(output: string): AgentMarker[] {
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed.map((a: { name?: string; id?: string; status?: string; description?: string; source?: string }) => ({ id: a.name || a.id || '', name: a.name || a.id || '', status: agentStatusFrom(a.status), x: hashPosition(a.name || a.id || '').x, y: hashPosition(a.name || a.id || '').y, location: a.description || a.source || '未知' }));
    if (parsed.agents && Array.isArray(parsed.agents)) return parsed.agents.map((a: { name?: string; id?: string; status?: string; description?: string; source?: string }) => ({ id: a.name || a.id || '', name: a.name || a.id || '', status: agentStatusFrom(a.status), ...hashPosition(a.name || a.id || ''), location: a.description || a.source || '未知' }));
  } catch { /* fall through */ }
  const lines = output.split('\n').filter(Boolean);
  return lines.map((line, i) => {
    const parts = line.trim().split(/\s+/);
    const name = parts[0]?.replace(/^[*\-+•]/, '') ?? `Agent-${i}`;
    return { id: name, name, status: line.toLowerCase().includes('running') || line.toLowerCase().includes('online') ? 'online' : line.toLowerCase().includes('alert') || line.toLowerCase().includes('error') ? 'alert' : 'offline', ...hashPosition(name), location: parts.slice(1).join(' ') || '未知' };
  });
}

function agentStatusFrom(s?: string): AgentStatus {
  if (!s) return 'offline';
  const l = s.toLowerCase();
  if (l.includes('run') || l.includes('online') || l.includes('active')) return 'online';
  if (l.includes('alert') || l.includes('error') || l.includes('warn')) return 'alert';
  return 'offline';
}

// ── Design Tokens ─────────────────────────────────────────────────────────────

const C = {
  primary: '#630ed4',
  primaryContainer: '#7c3aed',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#ede0ff',
  surfaceLowest: '#ffffff',
  surfaceLow: '#f2f4f6',
  surfaceHigh: '#e6e8ea',
  surfaceContainer: '#eceef0',
  onSurface: '#191c1e',
  onSurfaceVariant: '#4a4455',
  outline: '#7b7487',
  outlineVariant: '#ccc3d8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ba1a1a',
};

// ── Types ───────────────────────────────────────────────────────────────────

type AgentStatus = 'online' | 'offline' | 'alert';

interface AgentMarker {
  id: string;
  name: string;
  status: AgentStatus;
  x: string; // percentage
  y: string; // percentage
  location: string;
}

interface AgentDetail {
  id: string;
  name: string;
  status: AgentStatus;
  location: string;
  signal: number;
  lat: number;
  lng: number;
  altitude: number;
  task: string;
}

// ── City map SVG background ─────────────────────────────────────────────────

const CityMapBackground = () => (
  <svg
    style={{ width: '100%', height: '100%', filter: 'grayscale(100%) contrast(1.25)', opacity: 0.7 }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#b0b8c0" strokeWidth="0.5" />
      </pattern>
      <pattern id="blocks" width="200" height="200" patternUnits="userSpaceOnUse">
        {/* City block shapes */}
        <rect x="10" y="10" width="60" height="40" fill="#c8d0d8" rx="2" />
        <rect x="80" y="10" width="80" height="60" fill="#bcc4cc" rx="2" />
        <rect x="10" y="60" width="40" height="80" fill="#c4ccd4" rx="2" />
        <rect x="60" y="80" width="120" height="50" fill="#b8c0c8" rx="2" />
        <rect x="10" y="150" width="90" height="40" fill="#c0c8d0" rx="2" />
        <rect x="110" y="150" width="70" height="40" fill="#bcc8d0" rx="2" />
        <rect x="10" y="195" width="170" height="3" fill="#d0d8e0" />
        <rect x="190" y="10" width="3" height="185" fill="#d0d8e0" />
        {/* Main roads */}
        <rect x="0" y="78" width="200" height="4" fill="#a8b0b8" />
        <rect x="78" y="0" width="4" height="200" fill="#a8b0b8" />
        <rect x="0" y="148" width="200" height="2" fill="#b8c0c8" />
        <rect x="178" y="0" width="2" height="200" fill="#b8c0c8" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="#e8edf0" />
    <rect width="100%" height="100%" fill="url(#grid)" />
    <rect width="100%" height="100%" fill="url(#blocks)" />
    {/* River / water feature */}
    <path d="M0 130 Q80 120 160 140 Q180 145 200 138" fill="none" stroke="#c8d8e8" strokeWidth="6" />
    {/* Highlight roads */}
    <path d="M0 78 L200 78" stroke="#8898a8" strokeWidth="3" />
    <path d="M78 0 L78 200" stroke="#8898a8" strokeWidth="3" />
  </svg>
);

// ── Agent marker ─────────────────────────────────────────────────────────────

interface MarkerProps {
  agent: AgentMarker;
  active: boolean;
  onSelect: (id: string) => void;
}

const AgentMarker = ({ agent, active, onSelect }: MarkerProps) => {
  const [hovered, setHovered] = useState(false);
  const statusColor =
    agent.status === 'online' ? C.success
    : agent.status === 'alert' ? C.error
    : C.warning;

  return (
    <div
      onClick={() => onSelect(agent.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: agent.x,
        top: agent.y,
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
        cursor: 'pointer',
      }}
    >
      {/* Dot */}
      <div
        style={{
          width: active ? 14 : 10,
          height: active ? 14 : 10,
          borderRadius: '50%',
          background: statusColor,
          border: `3px solid ${C.surfaceLowest}`,
          boxShadow: active
            ? `0 0 0 3px ${statusColor}40, 0 4px 12px rgba(0,0,0,0.15)`
            : '0 2px 6px rgba(0,0,0,0.1)',
          transition: 'all 0.2s',
          animation: agent.status === 'online' ? 'markerPulse 2s ease-in-out infinite' : 'none',
          position: 'relative',
        }}
      />

      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: `${C.surfaceLowest}98`,
            backdropFilter: 'blur(8px)',
            borderRadius: 8,
            padding: '8px 10px',
            width: 140,
            border: `1px solid ${C.outlineVariant}30`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: C.onSurfaceVariant, letterSpacing: '0.05em' }}>
              {agent.status === 'online' ? '在线' : agent.status === 'alert' ? '警报' : '离线'}
            </span>
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.onSurface, margin: '0 0 2px' }}>
            Agent #{agent.id}
          </p>
          <p style={{ fontSize: 10, color: C.onSurfaceVariant, margin: 0 }}>
            {agent.location}
          </p>
        </div>
      )}
    </div>
  );
};

// ── Detail sidebar ────────────────────────────────────────────────────────────

interface DetailSidebarProps {
  agent: AgentDetail | null;
  onClose: () => void;
}

const DetailSidebar = ({ agent, onClose }: DetailSidebarProps) => {
  if (!agent) return null;

  const statusColor =
    agent.status === 'online' ? C.success
    : agent.status === 'alert' ? C.error
    : C.warning;

  return (
    <aside style={{
      position: 'absolute',
      left: 24,
      bottom: 24,
      zIndex: 30,
      width: 300,
    }}>
      <div style={{
        background: `${C.surfaceLowest}95`,
        backdropFilter: 'blur(16px)',
        borderRadius: 20,
        border: `1px solid ${C.outlineVariant}30`,
        boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${C.outlineVariant}20` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
                代理详情
              </p>
              <p style={{ fontSize: 16, fontWeight: 800, color: C.onSurface, margin: 0 }}>
                {agent.name}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                border: 'none', background: C.surfaceLow, color: C.onSurfaceVariant,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0, flexShrink: 0,
              }}
            >
              <X size={13} />
            </button>
          </div>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: C.surfaceLow, borderRadius: 10, padding: '8px 10px' }}>
              <p style={{ fontSize: 9, color: `${C.onSurfaceVariant}99`, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                当前状态
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.onSurface }}>{agent.task}</span>
              </div>
            </div>
            <div style={{ background: C.surfaceLow, borderRadius: 10, padding: '8px 10px' }}>
              <p style={{ fontSize: 9, color: `${C.onSurfaceVariant}99`, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px' }}>
                信号强度
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: agent.signal > 80 ? C.success : agent.signal > 40 ? C.warning : C.error,
                }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: C.onSurface }}>{agent.signal}%</span>
              </div>
            </div>
          </div>
        </div>
        {/* Coordinates */}
        <div style={{ padding: '14px 20px' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: `${C.onSurfaceVariant}99`, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
            实时位置数据
          </p>
          {[
            { label: '经度', value: `${agent.lng}° E` },
            { label: '纬度', value: `${agent.lat}° N` },
            { label: '海拔', value: `${agent.altitude}m` },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: i < arr.length - 1 ? `1px solid ${C.outlineVariant}15` : 'none',
              }}
            >
              <span style={{ fontSize: 12, color: C.onSurfaceVariant }}>{row.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: C.onSurface }}>{row.value}</span>
            </div>
          ))}
        </div>
        {/* Actions */}
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            style={{
              width: '100%', padding: '9px 0', borderRadius: 10,
              border: 'none',
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryContainer})`,
              color: C.onPrimary,
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              boxShadow: `0 4px 16px ${C.primary}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6,
            }}
          >
            远程接管
          </button>
          <button
            style={{
              width: '100%', padding: '9px 0', borderRadius: 10,
              border: `1px solid ${C.outlineVariant}`,
              background: 'transparent',
              color: C.onSurface,
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            查看完整日志
          </button>
        </div>
      </div>
    </aside>
  );
};

// ── Main MapPage ──────────────────────────────────────────────────────────────

export default function MapPage() {
  const api = window.electronAPI;
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentMarker[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  const loadAgents = useCallback(() => {
    if (!api?.listAgents) { setAgentsLoading(false); return; }
    api.listAgents().then((result) => {
      if (result.success && result.stdout) {
        setAgents(parseAgentsOutput(result.stdout));
      }
    }).catch(() => {}).finally(() => setAgentsLoading(false));
  }, [api]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const activeAgent = selectedAgentId ? agents.find((a) => a.id === selectedAgentId) ?? null : null;
  const selectedDetail: AgentDetail | null = activeAgent ? {
    id: activeAgent.id,
    name: activeAgent.name,
    status: activeAgent.status,
    location: activeAgent.location,
    signal: 60 + (activeAgent.name.charCodeAt(0) % 40),
    lat: 31.0 + (activeAgent.name.charCodeAt(0) % 100) / 1000,
    lng: 121.3 + (activeAgent.name.charCodeAt(activeAgent.name.length - 1) % 100) / 1000,
    altitude: 5 + (activeAgent.name.charCodeAt(0) % 20),
    task: activeAgent.status === 'online' ? '运行中' : activeAgent.status === 'alert' ? '告警中' : '已停止',
  } : null;

  const filteredAgents = agents.filter(
    (a) =>
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        height: '100%',
        overflow: 'hidden',
        background: C.surfaceLow,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
      }}
    >
      {/* Map canvas */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <CityMapBackground />
        {/* Subtle purple tint overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `${C.primary}04`,
          pointerEvents: 'none',
        }} />
        {/* Top gradient fade */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 100,
          background: `linear-gradient(to bottom, ${C.surfaceLowest}90 0%, transparent 25%)`,
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── Header overlay (top-left) ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 24, left: 28, zIndex: 30,
        background: `${C.surfaceLowest}90`,
        backdropFilter: 'blur(12px)',
        borderRadius: 14,
        padding: '14px 18px',
        border: `1px solid ${C.outlineVariant}25`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        pointerEvents: 'auto',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: C.onSurface, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          代理分布图
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '2px 8px', borderRadius: 999,
            background: C.primary, color: '#fff',
            fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          }}>
            实时更新
          </span>
          <span style={{ fontSize: 12, color: `${C.onSurfaceVariant}99`, fontWeight: 500 }}>
            当前活跃代理: {agentsLoading ? '—' : agents.filter((a) => a.status === 'online').length}
          </span>
        </div>
      </div>

      {/* ── Search + Filter (top-right) ─────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 24, right: 28, zIndex: 30,
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        {/* Search bar */}
        <div style={{
          display: 'flex',
          background: `${C.surfaceLowest}90`,
          backdropFilter: 'blur(12px)',
          borderRadius: 999,
          border: `1px solid ${C.outlineVariant}30`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '0 12px', display: 'flex', alignItems: 'center' }}>
            <Search size={15} color={C.onSurfaceVariant} />
          </div>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索代理 ID..."
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 13,
              color: C.onSurface,
              width: 160,
              padding: '10px 0',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => setSearchQuery('')}
            style={{
              padding: '0 10px',
              background: 'transparent',
              border: 'none',
              color: C.onSurfaceVariant,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={13} />
          </button>
        </div>
        {/* Filter button */}
        <button
          onClick={() => setFilterOpen((p) => !p)}
          title="筛选"
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: filterOpen ? C.primary : `${C.surfaceLowest}90`,
            backdropFilter: 'blur(12px)',
            border: `1px solid ${C.outlineVariant}30`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            color: filterOpen ? C.onPrimary : C.onSurface,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
            transition: 'all 0.15s',
          }}
        >
          <Filter size={16} />
        </button>
      </div>

      {/* ── Filter panel ──────────────────────────────────────────────────── */}
      {filterOpen && (
        <div style={{
          position: 'absolute', top: 76, right: 28, zIndex: 40,
          background: `${C.surfaceLowest}98`,
          backdropFilter: 'blur(16px)',
          borderRadius: 14,
          border: `1px solid ${C.outlineVariant}40`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          padding: '14px 16px',
          minWidth: 180,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            代理状态
          </p>
          {(['online', 'offline', 'alert'] as AgentStatus[]).map((status) => {
            const color = status === 'online' ? C.success : status === 'alert' ? C.error : C.warning;
            const label = status === 'online' ? '在线' : status === 'alert' ? '警报' : '离线';
            return (
              <div
                key={status}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 13, color: C.onSurface, fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: 11, color: C.onSurfaceVariant, marginLeft: 'auto' }}>
                  {agentsLoading ? '—' : agents.filter((a) => a.status === status).length} 个
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Legend (floating, top-left-ish) ──────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 110, left: 28, zIndex: 20,
        display: 'flex', gap: 0,
        background: `${C.surfaceLowest}80`,
        backdropFilter: 'blur(8px)',
        borderRadius: 999,
        border: `1px solid ${C.outlineVariant}20`,
        overflow: 'hidden',
      }}>
        {([
          { color: C.success, label: '在线' },
          { color: C.warning, label: '离线' },
          { color: C.error, label: '警报' },
        ] as { color: string; label: string }[]).map((item, i, arr) => (
          <div
            key={item.label}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px',
              borderRight: i < arr.length - 1 ? `1px solid ${C.outlineVariant}25` : 'none',
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: item.color }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: C.onSurfaceVariant }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Map controls (bottom-right) ───────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 24, right: 28, zIndex: 30,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{
          background: `${C.surfaceLowest}90`,
          backdropFilter: 'blur(12px)',
          borderRadius: 14,
          border: `1px solid ${C.outlineVariant}30`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}>
          {[
            { Icon: Plus, label: '放大' },
            { Icon: Minus, label: '缩小' },
            { Icon: Crosshair, label: '定位' },
          ].map(({ Icon, label }, i, arr) => (
            <button
              key={label}
              title={label}
              style={{
                width: 42, height: 42,
                border: 'none',
                background: 'transparent',
                color: C.onSurfaceVariant,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                borderBottom: i < arr.length - 1 ? `1px solid ${C.outlineVariant}20` : 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = C.surfaceHigh; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <Icon size={17} />
            </button>
          ))}
        </div>
        <button
          title="图层"
          style={{
            width: 42, height: 42, borderRadius: 14,
            background: `${C.surfaceLowest}90`,
            backdropFilter: 'blur(12px)',
            border: `1px solid ${C.outlineVariant}30`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            color: C.onSurface,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}
        >
          <Layers size={17} />
        </button>
      </div>

      {/* ── Agent markers ─────────────────────────────────────────────────── */}
      {filteredAgents.map((agent) => (
        <AgentMarker
          key={agent.id}
          agent={agent}
          active={selectedAgentId === agent.id}
          onSelect={(id) => setSelectedAgentId((prev) => (prev === id ? null : id))}
        />
      ))}

      {/* ── Detail sidebar ───────────────────────────────────────────────── */}
      <DetailSidebar
        agent={selectedAgentId ? selectedDetail : null}
        onClose={() => setSelectedAgentId(null)}
      />

      {/* Pulse animation */}
      <style>{`
        @keyframes markerPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.outlineVariant}; border-radius: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}
