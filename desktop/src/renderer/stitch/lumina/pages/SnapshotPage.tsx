import React, { useState, useEffect } from 'react';
import {
  Camera,
  Clock,
  CheckCircle,
  RotateCcw,
  ChevronRight,
  Filter,
  Plus,
  HardDrive,
  Activity,
  AlertCircle,
  Calendar,
  X,
  Trash2,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Snapshot {
  id: string;
  version: string;
  timestamp: Date;
  description: string;
  isCurrent: boolean;
  status: 'success' | 'warning' | 'error';
  health: number | null;
  memoryUsage: number | null;
  memoryTotal: number | null;
  storageUsage: number | null;
  storageTotal: number | null;
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

// ─────────────────────────────────────────────
// OpenClaw backup → Snapshot parser
// ─────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 30) return `${diffDay} 天前`;
  return date.toLocaleDateString('zh-CN');
}

function formatPercentMetric(value: number | null): string {
  return typeof value === 'number' ? `${value}%` : 'N/A';
}

function formatMemoryMetric(value: number | null): string {
  return typeof value === 'number' ? `${value} GB` : 'N/A';
}

function formatMemorySubMetric(value: number | null, total: number | null): string {
  if (typeof value !== 'number' || typeof total !== 'number' || total <= 0) {
    return '备份列表未提供内存元数据';
  }

  return `${Math.round((value / total) * 100)}% / ${total} GB`;
}

/**
 * Parse OpenClaw `backup list` stdout into Snapshot[].
 * OpenClaw outputs one backup per line: "ID  DATE  DESCRIPTION"
 * or JSON array [{ id, date, description, size }]
 */
function parseSnapshotsFromBackup(result: CommandResult): Snapshot[] {
  if (!result.success || !result.stdout) return [];

  try {
    // Try JSON array first
    const parsed = JSON.parse(result.stdout);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, idx) => ({
        id: item.id ?? item.name ?? `snap-${idx}`,
        version: item.version ?? item.tag ?? item.label ?? 'v1.0',
        timestamp: item.date ? new Date(item.date) : new Date(),
        description: item.description ?? item.note ?? item.label ?? '',
        isCurrent: idx === 0,
        status: item.status === 'failed' ? 'error' as const : 'success' as const,
        health: typeof item.health === 'number' ? item.health : null,
        memoryUsage: typeof item.memory === 'number'
          ? item.memory
          : typeof item.memoryUsage === 'number'
          ? item.memoryUsage
          : null,
        memoryTotal: typeof item.memoryTotal === 'number' ? item.memoryTotal : null,
        storageUsage: typeof item.storage === 'number'
          ? item.storage
          : typeof item.storageUsage === 'number'
          ? item.storageUsage
          : null,
        storageTotal: typeof item.storageTotal === 'number' ? item.storageTotal : null,
      }));
    }
  } catch {
    // fall through to line parsing
  }

  // Line-based fallback: "ID  YYYY-MM-DD  DESCRIPTION"
  const lines = result.stdout.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  return lines.map((line, idx) => {
    const parts = line.trim().split(/\s{2,}/);
    const isFailed = line.toLowerCase().includes('fail') || line.toLowerCase().includes('error');
    return {
      id: parts[0] ?? `snap-${Date.now()}-${idx}`,
      version: parts[3] ?? `v${(lines.length - idx).toFixed(1)}`,
      timestamp: parts[1] ? new Date(parts[1]) : new Date(Date.now() - idx * 86400000),
      description: parts.slice(2).join(' ').trim() || '系统快照',
      isCurrent: idx === 0,
      status: isFailed ? 'warning' as const : 'success' as const,
      health: null,
      memoryUsage: null,
      memoryTotal: null,
      storageUsage: null,
      storageTotal: null,
    } as Snapshot;
  });
}

// ─────────────────────────────────────────────
// Design Tokens
// ─────────────────────────────────────────────

const C = {
  primary: '#630ed4',
  primaryContainer: '#7c3aed',
  primaryLight: '#f3effe',
  surfaceLowest: '#ffffff',
  surfaceLow: '#f2f4f6',
  surface: '#eceef0',
  surfaceHigh: '#e6e8ea',
  onSurface: '#191c1e',
  onSurfaceVariant: '#4a4455',
  outline: '#7b7487',
  outlineVariant: '#d0cbd4',
  success: '#16a34a',
  successLight: '#dcfce7',
  warning: '#ca8a04',
  warningLight: '#fef9c3',
  error: '#dc2626',
  errorLight: '#fee2e2',
};

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────

function Toast(props: { message: string }) {
  const [visible, setVisible] = useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#1a1a1a',
        color: '#fff',
        padding: '10px 22px',
        borderRadius: '10px',
        fontSize: '13px',
        fontWeight: '500',
        zIndex: 9999,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        letterSpacing: '0.01em',
      }}
    >
      {props.message}
    </div>
  );
}

// ─────────────────────────────────────────────
// Confirm Dialog
// ─────────────────────────────────────────────

function ConfirmDialog(props: {
  version: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
        backdropFilter: 'blur(4px)',
      }}
      onClick={props.onCancel}
    >
      <div
        style={{
          background: C.surfaceLowest,
          borderRadius: '16px',
          padding: '28px 28px 24px',
          maxWidth: '380px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: C.errorLight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertCircle size={18} color={C.error} />
          </div>
          <span style={{ fontSize: '17px', fontWeight: '700', color: C.onSurface }}>
            确认还原快照
          </span>
        </div>
        <p style={{ fontSize: '14px', color: C.onSurfaceVariant, lineHeight: 1.6, margin: '0 0 22px' }}>
          确定要还原到 {props.version} 快照吗？当前未保存的更改将会丢失，建议先创建新快照再操作。
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={props.onCancel}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: `1px solid ${C.outlineVariant}`,
              background: C.surfaceLowest,
              color: C.onSurfaceVariant,
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            取消
          </button>
          <button
            onClick={props.onConfirm}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryContainer})`,
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: `0 2px 8px rgba(99, 14, 212, 0.25)`,
            }}
          >
            确认还原
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Snapshot Card
// ─────────────────────────────────────────────

interface CardProps {
  snapshot: Snapshot;
  showConfirm: boolean;
  onRequestRestore: () => void;
  onConfirmRestore: () => void;
  onCancelRestore: () => void;
  onDelete: () => void;
  onViewDetail: () => void;
  isDeleting?: boolean;
}

function SnapshotCard(props: CardProps) {
  const { snapshot } = props;
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const healthColor =
    typeof snapshot.health !== 'number'
      ? C.onSurfaceVariant
      : snapshot.health >= 98
      ? C.success
      : snapshot.health >= 95
      ? C.warning
      : C.error;

  const statusColor =
    snapshot.status === 'success'
      ? C.success
      : snapshot.status === 'warning'
      ? C.warning
      : C.error;

  const statusText =
    snapshot.status === 'success' ? '正常' : snapshot.status === 'warning' ? '部分异常' : '失败';

  const cardStyle: React.CSSProperties = snapshot.isCurrent
    ? {
        background: C.surfaceLowest,
        borderRadius: '14px',
        border: `1px solid ${C.primary}`,
        borderLeft: `4px solid ${C.primary}`,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '14px',
        boxShadow: `0 4px 16px rgba(99, 14, 212, 0.08)`,
      }
    : {
        background: C.surfaceLowest,
        borderRadius: '14px',
        border: `1px solid ${C.outlineVariant}`,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '14px',
      };

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 14px',
    borderRadius: '7px',
    border: `1.5px solid ${C.outlineVariant}`,
    background: 'transparent',
    color: C.onSurfaceVariant,
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  };

  const btnDetailHovered: React.CSSProperties = {
    background: C.surfaceLow,
    borderColor: C.primary,
    color: C.primary,
    transform: 'translateY(-1px)',
  };

  const btnRestoreHovered: React.CSSProperties = {
    background: C.primaryLight,
    borderColor: C.primary,
    color: C.primary,
    transform: 'translateY(-1px)',
    boxShadow: `0 2px 8px rgba(99, 14, 212, 0.15)`,
  };

  return (
    <>
      <div style={cardStyle}>
        {/* Card Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {snapshot.isCurrent && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: C.primaryLight,
                    color: C.primary,
                    fontSize: '11px',
                    fontWeight: '700',
                    letterSpacing: '0.04em',
                  }}
                >
                  <CheckCircle size={10} />
                  当前状态
                </span>
              )}
              <span style={{ fontSize: '16px', fontWeight: '700', color: C.onSurface, letterSpacing: '-0.01em' }}>
                {snapshot.version}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: C.onSurfaceVariant }}>
              <Calendar size={12} />
              {snapshot.timestamp.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
              <span style={{ opacity: 0.5, marginLeft: '4px' }}>
                ({formatRelativeTime(snapshot.timestamp)})
              </span>
            </div>
          </div>

          {snapshot.isCurrent && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                background: C.surfaceLow,
                flexShrink: 0,
              }}
            >
              <Camera size={14} color={C.primary} />
              <span style={{ fontSize: '12px', fontWeight: '600', color: C.primary }}>快照中</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p style={{ fontSize: '14px', color: C.onSurfaceVariant, lineHeight: 1.65, margin: 0 }}>
          {snapshot.description}
        </p>

        {/* Divider */}
        <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${C.outlineVariant}, transparent)` }} />

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <MetricCard
            label="系统健康"
            icon={<Activity size={11} />}
            value={formatPercentMetric(snapshot.health)}
            sub={typeof snapshot.health === 'number' ? '来自备份元数据' : '备份列表未提供健康度'}
            valueColor={healthColor}
          />
          <MetricCard
            label="内存占用"
            icon={<HardDrive size={11} />}
            value={formatMemoryMetric(snapshot.memoryUsage)}
            sub={formatMemorySubMetric(snapshot.memoryUsage, snapshot.memoryTotal)}
          />
          <MetricCard
            label="存储使用"
            icon={<HardDrive size={11} />}
            value={formatPercentMetric(snapshot.storageUsage)}
            sub={typeof snapshot.storageUsage === 'number' ? '来自备份元数据' : '备份列表未提供存储元数据'}
          />
          <MetricCard label="运行时长" icon={<Clock size={11} />} value="N/A" sub="备份列表未提供运行时长" />
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${C.outlineVariant}, transparent)` }} />

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '500', color: statusColor }}>
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: statusColor,
                boxShadow: `0 0 6px ${statusColor}`,
                flexShrink: 0,
              }}
            />
            {statusText}
          </div>

          {snapshot.isCurrent ? (
            <button
              style={{
                ...btnBase,
                borderColor: C.primary,
                color: C.primary,
                ...(hoveredBtn === 'detail' ? btnDetailHovered : {}),
              }}
              onMouseEnter={() => setHoveredBtn('detail')}
              onMouseLeave={() => setHoveredBtn(null)}
              onClick={props.onViewDetail}
            >
              查看详情
              <ChevronRight size={14} />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                style={{
                  ...btnBase,
                  ...(hoveredBtn === `restore-${snapshot.id}` ? btnRestoreHovered : {}),
                }}
                onMouseEnter={() => setHoveredBtn(`restore-${snapshot.id}`)}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={props.onRequestRestore}
              >
                <RotateCcw size={13} />
                还原
              </button>
              <button
                style={{
                  ...btnBase,
                  borderColor: props.isDeleting ? C.error : hoveredBtn === `delete-${snapshot.id}` ? C.error : `${C.outlineVariant}`,
                  color: props.isDeleting ? C.error : hoveredBtn === `delete-${snapshot.id}` ? C.error : C.onSurfaceVariant,
                  ...(hoveredBtn === `delete-${snapshot.id}` ? { background: C.errorLight, transform: 'translateY(-1px)' } : {}),
                }}
                onMouseEnter={() => setHoveredBtn(`delete-${snapshot.id}`)}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={props.isDeleting ? undefined : props.onDelete}
                disabled={props.isDeleting}
              >
                {props.isDeleting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                    删除中
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Trash2 size={13} />
                    删除
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      {props.showConfirm && (
        <ConfirmDialog
          version={snapshot.version}
          onConfirm={props.onConfirmRestore}
          onCancel={props.onCancelRestore}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// Metric Card
// ─────────────────────────────────────────────

function MetricCard(props: {
  label: string;
  icon: React.ReactNode;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background: C.surfaceLow,
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '11px',
          color: C.onSurfaceVariant,
          fontWeight: '500',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {props.icon}
        {props.label}
      </div>
      <div
        style={{
          fontSize: '20px',
          fontWeight: '800',
          color: props.valueColor ?? C.onSurface,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          marginTop: '2px',
        }}
      >
        {props.value}
      </div>
      <div style={{ fontSize: '11px', color: C.outline, marginTop: '2px' }}>{props.sub}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Spinner SVG
// ─────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      style={{ display: 'inline-block', verticalAlign: 'middle', animation: 'spin 0.8s linear infinite' }}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────

export default function SnapshotPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [hoveredFilter, setHoveredFilter] = useState(false);
  const [hoveredCreate, setHoveredCreate] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'warning' | 'error'>('all');
  const [detailSnapshot, setDetailSnapshot] = useState<Snapshot | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const api = window.electronAPI;

  // Load snapshots from OpenClaw backup list on mount
  const loadSnapshots = async () => {
    if (!api) {
      setSnapshots([]);
      return;
    }
    setLoading(true);
    try {
      const result: CommandResult = await api.listBackups();
      const parsed = parseSnapshotsFromBackup(result);
      setSnapshots(parsed);
    } catch {
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(msg: string) {
    setToastMsg(msg);
  }

  function handleFilterToggle() {
    setFilterOpen((p) => !p);
  }

  async function handleCreate() {
    if (!api) return;
    setIsCreating(true);
    showToast('正在创建快照...');
    try {
      const result: CommandResult = await api.runOpenClawCommand('backup create');
      if (result.success) {
        showToast('快照创建成功！');
        await loadSnapshots();
      } else {
        showToast(`快照创建失败: ${result.stderr || result.error || '未知错误'}`);
      }
    } catch (err) {
      showToast(`快照创建失败: ${String(err)}`);
    } finally {
      setIsCreating(false);
    }
  }

  function handleRestore(snapshotId: string) {
    setShowConfirm(snapshotId);
  }

  async function handleConfirmRestore() {
    if (!api || !showConfirm) return;
    const snapshotId = showConfirm;
    setShowConfirm(null);
    showToast('快照还原已启动，请稍候...');
    try {
      const result: CommandResult = await api.restoreBackup(snapshotId);
      if (result.success) {
        showToast('快照还原成功，系统已重启！');
      } else {
        showToast(`还原失败: ${result.stderr || result.error || '未知错误'}`);
      }
    } catch (err) {
      showToast(`还原失败: ${String(err)}`);
    }
  }

  async function handleDelete(snapshotId: string) {
    if (!api) return;
    setDeletingId(snapshotId);
    try {
      const result: CommandResult = await api.runOpenClawCommand(`backup delete ${snapshotId}`);
      if (result.success) {
        showToast('快照已删除');
        setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
      } else {
        showToast(`删除失败: ${result.stderr || result.error || '未知错误'}`);
      }
    } catch (err) {
      showToast(`删除失败: ${String(err)}`);
    } finally {
      setDeletingId(null);
    }
  }

  // Filtered snapshots based on active filters
  const displaySnapshots = snapshots.filter((s) => {
    const now = new Date();
    const age = now.getTime() - s.timestamp.getTime();
    const dayMs = 86400000;
    if (filterDate === 'today' && age > dayMs) return false;
    if (filterDate === 'week' && age > 7 * dayMs) return false;
    if (filterDate === 'month' && age > 30 * dayMs) return false;
    if (filterStatus !== 'all' && s.status !== filterStatus) return false;
    return true;
  });

  const btnFilterStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: `1px solid ${hoveredFilter ? C.outline : C.outlineVariant}`,
    background: hoveredFilter ? C.surface : C.surfaceLowest,
    color: hoveredFilter ? C.onSurface : C.onSurfaceVariant,
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
  };

  const btnCreateStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 18px',
    borderRadius: '8px',
    border: 'none',
    background:
      isCreating || hoveredCreate
        ? `linear-gradient(135deg, ${C.primaryContainer}, ${C.primary})`
        : `linear-gradient(135deg, ${C.primary}, ${C.primaryContainer})`,
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: isCreating ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    boxShadow: `0 2px 8px rgba(99, 14, 212, 0.25)`,
    opacity: isCreating ? 0.75 : 1,
  };

  return (
    <>
      <div
        style={{
          minHeight: '100vh',
          background: '#f7f9fb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: C.onSurface,
          padding: '40px 24px 80px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ maxWidth: '896px', margin: '0 auto', position: 'relative' }}>
          {/* Watermark */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '36px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '120px',
              fontWeight: '900',
              letterSpacing: '-0.05em',
              color: 'rgba(99, 14, 212, 0.04)',
              userSelect: 'none',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 0,
            }}
          >
            ARCHIVE
          </div>

          {/* Header */}
          <div style={{ position: 'relative', zIndex: 1, marginBottom: '40px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '12px',
                color: C.primary,
                fontSize: '13px',
                fontWeight: '600',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <Camera size={13} />
              Snapshot Manager
            </div>

            <h1
              style={{
                fontSize: '32px',
                fontWeight: '800',
                color: C.onSurface,
                margin: '0 0 10px',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              系统快照存档
            </h1>

            <p
              style={{
                fontSize: '15px',
                color: C.onSurfaceVariant,
                margin: '0 0 24px',
                lineHeight: 1.65,
              }}
            >
              系统快照用于记录当前运行环境、配置状态和资源使用情况。还原快照可以快速回滚到之前的稳定状态。
            </p>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                style={btnFilterStyle}
                onMouseEnter={() => setHoveredFilter(true)}
                onMouseLeave={() => setHoveredFilter(false)}
                onClick={handleFilterToggle}
              >
                <Filter size={14} />
                筛选
              </button>
              <button
                style={btnCreateStyle}
                onMouseEnter={() => !isCreating && setHoveredCreate(true)}
                onMouseLeave={() => setHoveredCreate(false)}
                onClick={handleCreate}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <SpinnerIcon />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    创建新快照
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Card Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px', position: 'relative', zIndex: 1 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '14px' }}>
                <SpinnerIcon />
                <span style={{ fontSize: '14px', color: C.onSurfaceVariant }}>正在加载快照...</span>
              </div>
            ) : displaySnapshots.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '40px 20px',
                  gap: '12px',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '3px',
                    borderRadius: '2px',
                    background: `linear-gradient(90deg, ${C.primary}, ${C.primaryContainer})`,
                    marginBottom: '4px',
                  }}
                />
                <p style={{ fontSize: '14px', color: C.onSurfaceVariant, margin: 0 }}>
                  暂无快照记录
                </p>
                <p style={{ fontSize: '12px', color: C.outline, margin: 0 }}>
                  点击右上角「创建新快照」开始备份
                </p>
              </div>
            ) : (
              displaySnapshots.map((snapshot) => (
                <SnapshotCard
                  key={snapshot.id}
                  snapshot={snapshot}
                  showConfirm={showConfirm === snapshot.id}
                  onRequestRestore={() => handleRestore(snapshot.id)}
                  onConfirmRestore={handleConfirmRestore}
                  onCancelRestore={() => setShowConfirm(null)}
                  onDelete={() => handleDelete(snapshot.id)}
                  onViewDetail={() => setDetailSnapshot(snapshot)}
                  isDeleting={deletingId === snapshot.id}
                />
              ))
            )}
          </div>

          {/* Filter Panel */}
          {filterOpen && (
            <div style={{
              position: 'absolute',
              top: '130px',
              left: '24px',
              zIndex: 100,
              background: C.surfaceLowest,
              borderRadius: '12px',
              border: `1px solid ${C.outlineVariant}`,
              padding: '16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              minWidth: '220px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: C.onSurface, marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                筛选条件
                <button onClick={() => setFilterOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.onSurfaceVariant, padding: 0 }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.onSurfaceVariant, marginBottom: '8px' }}>按日期</div>
              {(['all', 'today', 'week', 'month'] as const).map((opt) => (
                <button key={opt} onClick={() => setFilterDate(opt)} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px',
                  borderRadius: '6px', border: 'none', background: filterDate === opt ? `${C.primary}10` : 'transparent',
                  color: filterDate === opt ? C.primary : C.onSurfaceVariant,
                  fontSize: '12px', fontWeight: filterDate === opt ? 600 : 400, cursor: 'pointer', marginBottom: '3px',
                }}>
                  {{ all: '全部', today: '今天', week: '最近 7 天', month: '最近 30 天' }[opt]}
                </button>
              ))}
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.onSurfaceVariant, marginBottom: '8px', marginTop: '12px' }}>按状态</div>
              {(['all', 'success', 'warning', 'error'] as const).map((opt) => (
                <button key={opt} onClick={() => setFilterStatus(opt)} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px',
                  borderRadius: '6px', border: 'none', background: filterStatus === opt ? `${C.primary}10` : 'transparent',
                  color: filterStatus === opt ? C.primary : C.onSurfaceVariant,
                  fontSize: '12px', fontWeight: filterStatus === opt ? 600 : 400, cursor: 'pointer', marginBottom: '3px',
                }}>
                  {{ all: '全部', success: '正常', warning: '部分异常', error: '失败' }[opt]}
                </button>
              ))}
              <button onClick={() => { setFilterDate('all'); setFilterStatus('all'); }}
                style={{ marginTop: '12px', width: '100%', padding: '6px', borderRadius: '6px', border: `1px solid ${C.outlineVariant}`, background: 'transparent', color: C.onSurfaceVariant, fontSize: '12px', cursor: 'pointer' }}>
                重置筛选
              </button>
            </div>
          )}

          {/* Detail Panel */}
          {detailSnapshot && (
            <div style={{
              background: C.surfaceLowest,
              borderRadius: '14px',
              border: `1px solid ${C.primary}30`,
              padding: '20px 24px',
              marginBottom: '16px',
              boxShadow: `0 4px 16px ${C.primary}08`,
              position: 'relative',
              zIndex: 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: C.onSurface }}>快照详情 — {detailSnapshot.version}</div>
                <button onClick={() => setDetailSnapshot(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.onSurfaceVariant }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { label: '创建时间', value: detailSnapshot.timestamp.toLocaleString('zh-CN') },
                  { label: '系统健康', value: formatPercentMetric(detailSnapshot.health) },
                  {
                    label: '内存占用',
                    value: detailSnapshot.memoryUsage !== null && detailSnapshot.memoryTotal !== null
                      ? `${detailSnapshot.memoryUsage} / ${detailSnapshot.memoryTotal} GB`
                      : 'N/A',
                  },
                  { label: '存储使用', value: formatPercentMetric(detailSnapshot.storageUsage) },
                  { label: '系统状态', value: detailSnapshot.status === 'success' ? '正常' : detailSnapshot.status === 'warning' ? '部分异常' : '失败' },
                  { label: '快照ID', value: detailSnapshot.id },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: C.surfaceLow, borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: C.onSurfaceVariant, marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: C.onSurface, wordBreak: 'break-all' }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '14px', padding: '12px', background: C.surfaceLow, borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: C.onSurfaceVariant, marginBottom: '6px' }}>描述</div>
                <div style={{ fontSize: '13px', color: C.onSurface }}>{detailSnapshot.description}</div>
              </div>
            </div>
          )}

          {/* Empty State */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '40px 20px',
              gap: '12px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div
              style={{
                width: '48px',
                height: '3px',
                borderRadius: '2px',
                background: `linear-gradient(90deg, ${C.primary}, ${C.primaryContainer})`,
                marginBottom: '4px',
              }}
            />
            <p style={{ fontSize: '14px', color: C.outline, textAlign: 'center', margin: 0 }}>
              快照保留最近 30 天内的记录，超期快照将自动清理
            </p>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && <Toast message={toastMsg} />}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
