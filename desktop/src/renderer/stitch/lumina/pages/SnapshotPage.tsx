'use client';

import React, { useState } from 'react';
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
  health: number;
  memoryUsage: number;
  memoryTotal: number;
  storageUsage: number;
  storageTotal: number;
}

// ─────────────────────────────────────────────
// Mock Data
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

const MOCK_SNAPSHOTS: Snapshot[] = [
  {
    id: 'snap-current',
    version: 'v2.4.1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    description: '系统当前运行状态快照，包含最新配置和通道状态',
    isCurrent: true,
    status: 'success',
    health: 99.8,
    memoryUsage: 2.4,
    memoryTotal: 12,
    storageUsage: 45,
    storageTotal: 100,
  },
  {
    id: 'snap-1',
    version: 'v2.4.0',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
    description: 'Gateway 通道配置更新后创建，包含 OpenClaw 插件重载',
    isCurrent: false,
    status: 'success',
    health: 98.2,
    memoryUsage: 2.1,
    memoryTotal: 12,
    storageUsage: 43,
    storageTotal: 100,
  },
  {
    id: 'snap-2',
    version: 'v2.3.9',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    description: '日常自动快照，SUPABASE 连接池优化后备份',
    isCurrent: false,
    status: 'warning',
    health: 94.5,
    memoryUsage: 3.1,
    memoryTotal: 12,
    storageUsage: 47,
    storageTotal: 100,
  },
  {
    id: 'snap-3',
    version: 'v2.3.8',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    description: '版本更新前手动快照，包含所有渠道凭证和用户配置',
    isCurrent: false,
    status: 'success',
    health: 99.1,
    memoryUsage: 1.9,
    memoryTotal: 12,
    storageUsage: 41,
    storageTotal: 100,
  },
];

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
}

function SnapshotCard(props: CardProps) {
  const { snapshot } = props;
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const healthColor =
    snapshot.health >= 98 ? C.success : snapshot.health >= 95 ? C.warning : C.error;

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
            value={`${snapshot.health}%`}
            sub="运行正常"
            valueColor={healthColor}
          />
          <MetricCard
            label="内存占用"
            icon={<HardDrive size={11} />}
            value={`${snapshot.memoryUsage} GB`}
            sub={`${Math.round((snapshot.memoryUsage / snapshot.memoryTotal) * 100)}% / ${snapshot.memoryTotal} GB`}
          />
          <MetricCard
            label="存储使用"
            icon={<HardDrive size={11} />}
            value={`${snapshot.storageUsage}%`}
            sub="数据盘已用空间"
          />
          <MetricCard label="运行时长" icon={<Clock size={11} />} value="6.2h" sub="自上次重启" />
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
            >
              查看详情
              <ChevronRight size={14} />
            </button>
          ) : (
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
              还原快照
            </button>
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
  const [isCreating, setIsCreating] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [hoveredFilter, setHoveredFilter] = useState(false);
  const [hoveredCreate, setHoveredCreate] = useState(false);

  function showToast(msg: string) {
    setToastMsg(msg);
  }

  function handleFilter() {
    showToast('快照筛选功能开发中...');
  }

  function handleCreate() {
    setIsCreating(true);
    showToast('正在创建快照...');
    setTimeout(() => {
      setIsCreating(false);
      showToast('快照创建成功！');
    }, 1800);
  }

  function handleRestore(snapshotId: string) {
    setShowConfirm(snapshotId);
  }

  function handleConfirmRestore() {
    setShowConfirm(null);
    showToast('快照还原已启动，请稍候...');
    setTimeout(() => {
      showToast('快照还原成功，系统已重启！');
    }, 2000);
  }

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
                onClick={handleFilter}
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
            {MOCK_SNAPSHOTS.map((snapshot) => (
              <SnapshotCard
                key={snapshot.id}
                snapshot={snapshot}
                showConfirm={showConfirm === snapshot.id}
                onRequestRestore={() => handleRestore(snapshot.id)}
                onConfirmRestore={handleConfirmRestore}
                onCancelRestore={() => setShowConfirm(null)}
              />
            ))}
          </div>

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
