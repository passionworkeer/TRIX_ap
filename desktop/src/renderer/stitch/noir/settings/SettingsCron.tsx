import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, AlertTriangle, ToggleLeft, ToggleRight, Play } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import { CronExpressionPicker } from '../../../shared/components/CronExpressionPicker';
import type { SettingsSharedState } from './SettingsContainer';

interface CronJob {
  id: string;
  agentId: string;
  name: string;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: {
    expr?: string;
    kind: 'cron' | 'every';
    everyMs?: number;
    tz?: string;
    staggerMs?: number;
  };
  sessionTarget?: string;
  wakeMode?: string;
  payload: {
    kind: string;
    message: string;
    timeoutSeconds?: number;
    model?: string;
  };
  delivery: {
    mode: string;
    channel?: string;
    to?: string;
    accountId?: string;
  };
  state: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
    lastStatus?: string;
    lastDurationMs?: number;
    consecutiveErrors?: number;
    lastError?: string;
  };
  enabled: boolean;
}

export function SettingsCron(_props: SettingsSharedState) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);

  const loadJobs = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.cronList();
      if (result.success && Array.isArray(result.data)) {
        setJobs(result.data as CronJob[]);
      } else {
        setError(result.error || '加载失败');
      }
    } catch {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    const api = window.electronAPI;
    if (!api) return;
    setSaving(true);
    try {
      const result = await api.cronToggle(id, enabled);
      if (result.success) {
        setJobs(prev => prev.map(j => j.id === id ? { ...j, enabled } : j));
      } else {
        setError(result.error || '操作失败');
      }
    } catch {
      setError('操作失败');
    } finally {
      setSaving(false);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('确认删除此定时任务？')) return;
    const api = window.electronAPI;
    if (!api) return;
    setSaving(true);
    try {
      const result = await api.cronDelete(id);
      if (result.success) {
        setJobs(prev => prev.filter(j => j.id !== id));
      } else {
        setError(result.error || '删除失败');
      }
    } catch {
      setError('删除失败');
    } finally {
      setSaving(false);
    }
  }, []);

  const formatNextRun = (ms?: number) => {
    if (!ms) return '—';
    const diff = ms - Date.now();
    if (diff < 0) return '已错过';
    if (diff < 60000) return `${Math.round(diff / 1000)}秒后`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}分钟后`;
    return new Date(ms).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  };

  const statusIcon = (status?: string) => {
    if (status === 'ok') return <CheckCircle size={13} color="#4ade80" />;
    if (status === 'error') return <XCircle size={13} color="#ff6b6b" />;
    if (status === 'timeout') return <AlertTriangle size={13} color="#f59e0b" />;
    return null;
  };

  if (loading) {
    return <div style={{ color: '#919191', fontSize: 13 }}>加载中...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>定时任务</div>
          <div style={{ fontSize: 12, color: '#919191', marginTop: 2 }}>
            {jobs.filter(j => j.enabled).length}/{jobs.length} 个任务已启用
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <DarkButton label="刷新" onClick={loadJobs} variant="outline" size="sm" />
          <DarkButton
            label="新建任务"
            icon={<Plus size={12} />}
            onClick={() => setShowCreate(true)}
            variant="primary"
            size="sm"
            disabled={saving}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 10, color: '#ff6b6b', fontSize: 12 }}>
          {error}
          <span style={{ marginLeft: 8, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setError(null)}>关闭</span>
        </div>
      )}

      {/* Job List */}
      {jobs.length === 0 ? (
        <DarkCard elevation="low">
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#919191', fontSize: 13 }}>
            暂无定时任务，点击「新建任务」开始配置
          </div>
        </DarkCard>
      ) : (
        jobs.map(job => (
          <JobCard
            key={job.id}
            job={job}
            expanded={!!expanded[job.id]}
            onToggle={() => handleToggle(job.id, !job.enabled)}
            onDelete={() => handleDelete(job.id)}
            onExpand={() => setExpanded(prev => ({ ...prev, [job.id]: !prev[job.id] }))}
            formatNextRun={formatNextRun}
            statusIcon={statusIcon}
          />
        ))
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateJobModal
          onClose={() => setShowCreate(false)}
          onCreated={job => {
            setJobs(prev => [...prev, job]);
            setShowCreate(false);
          }}
          saving={saving}
          setSaving={setSaving}
          setError={setError}
        />
      )}
    </div>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────────────

interface JobCardProps {
  job: CronJob;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onExpand: () => void;
  formatNextRun: (ms?: number) => string;
  statusIcon: (status?: string) => React.ReactNode;
}

function JobCard({ job, expanded, onToggle, onDelete, onExpand, formatNextRun, statusIcon }: JobCardProps) {
  return (
    <DarkCard elevation="low">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Toggle */}
        <div style={{ paddingTop: 2, cursor: 'pointer' }} onClick={onToggle} title={job.enabled ? '点击禁用' : '点击启用'}>
          {job.enabled
            ? <ToggleRight size={22} color="#4ade80" />
            : <ToggleLeft size={22} color="#555" />
          }
        </div>

        {/* Main info */}
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={onExpand}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: job.enabled ? '#e5e2e1' : '#666' }}>
              {job.name}
            </span>
            {statusIcon(job.state?.lastRunStatus)}
          </div>
          <div style={{ fontSize: 11, color: '#919191', marginTop: 3 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{job.schedule.expr || `${job.schedule.kind} ${job.schedule.everyMs}ms`}</span>
            {' · '}
            Agent: <strong>{job.agentId}</strong>
            {' · '}
            {job.delivery.mode !== 'none' ? `投递: ${job.delivery.mode}` : '无投递'}
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
            下次: {formatNextRun(job.state?.nextRunAtMs)}
            {job.state?.lastDurationMs && ` · 上次耗时: ${Math.round(job.state.lastDurationMs / 1000)}s`}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, cursor: 'pointer', color: '#919191' }} title="删除" onClick={onDelete}>
            <Trash2 size={13} />
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>任务描述</div>
          <div style={{ fontSize: 12, color: '#919191', background: '#0e0e0e', borderRadius: 8, padding: '10px 12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 200, overflowY: 'auto' }}>
            {job.payload.message?.slice(0, 500)}{job.payload.message?.length > 500 ? '...' : ''}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 11, color: '#555' }}>Agent ID</span><div style={{ fontSize: 12, color: '#e5e2e1' }}>{job.agentId}</div></div>
            <div><span style={{ fontSize: 11, color: '#555' }}>调度类型</span><div style={{ fontSize: 12, color: '#e5e2e1' }}>{job.schedule.kind}</div></div>
            <div><span style={{ fontSize: 11, color: '#555' }}>时区</span><div style={{ fontSize: 12, color: '#e5e2e1' }}>{job.schedule.tz || 'Asia/Shanghai'}</div></div>
            {job.state?.lastError && <div><span style={{ fontSize: 11, color: '#555' }}>最近错误</span><div style={{ fontSize: 12, color: '#ff6b6b' }}>{job.state.lastError}</div></div>}
          </div>
        </div>
      )}
    </DarkCard>
  );
}

// ── Create Job Modal ──────────────────────────────────────────────────────────

interface CreateJobModalProps {
  onClose: () => void;
  onCreated: (job: CronJob) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;
  setError: (e: string | null) => void;
}

function CreateJobModal({ onClose, onCreated, saving, setSaving, setError }: CreateJobModalProps) {
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('main');
  const [cronExpr, setCronExpr] = useState('0 9 * * *');
  const [message, setMessage] = useState('');
  const [deliveryMode, setDeliveryMode] = useState('none');

  const handleCreate = async () => {
    if (!name.trim() || !message.trim()) return;
    const api = window.electronAPI;
    if (!api) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        agentId,
        name,
        schedule: { kind: 'cron', expr: cronExpr, tz: 'Asia/Shanghai' },
        sessionTarget: 'isolated',
        wakeMode: 'now',
        payload: { kind: 'agentTurn', message, timeoutSeconds: 1800 },
        delivery: { mode: deliveryMode },
        enabled: true,
      };
      const result = await api.cronCreate(payload);
      if (result.success) {
        // Refetch full list to get the server-assigned id
        const list = await api.cronList();
        if (list.success && Array.isArray(list.data)) {
          const newJob = (list.data as CronJob[]).find(j => j.name === name);
          if (newJob) onCreated(newJob);
          else onClose();
        } else {
          onClose();
        }
      } else {
        setError(result.error || '创建失败');
      }
    } catch {
      setError('创建失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#1c1b1b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 24, width: 560, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e5e2e1', marginBottom: 20 }}>新建定时任务</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 12, color: '#919191', display: 'block', marginBottom: 5 }}>任务名称 *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="例如：每日 GitHub 检查"
              style={{ width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#e5e2e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {/* Agent */}
          <div>
            <label style={{ fontSize: 12, color: '#919191', display: 'block', marginBottom: 5 }}>Agent</label>
            <select value={agentId} onChange={e => setAgentId(e.target.value)}
              style={{ width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#e5e2e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
              <option value="main">main</option>
              <option value="worker">worker</option>
            </select>
          </div>

          {/* Cron */}
          <div>
            <label style={{ fontSize: 12, color: '#919191', display: 'block', marginBottom: 5 }}>执行时间</label>
            <CronExpressionPicker value={cronExpr} onChange={setCronExpr} />
          </div>

          {/* Message */}
          <div>
            <label style={{ fontSize: 12, color: '#919191', display: 'block', marginBottom: 5 }}>任务指令 *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="给 Agent 的指令..."
              style={{ width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#e5e2e1', fontSize: 12, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'monospace', lineHeight: 1.5 }} />
          </div>

          {/* Delivery Mode */}
          <div>
            <label style={{ fontSize: 12, color: '#919191', display: 'block', marginBottom: 5 }}>结果投递</label>
            <select value={deliveryMode} onChange={e => setDeliveryMode(e.target.value)}
              style={{ width: '100%', background: '#0e0e0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#e5e2e1', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
              <option value="none">不投递</option>
              <option value="announce">通知（announce）</option>
              <option value="direct">直接消息（direct）</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <DarkButton label="取消" onClick={onClose} variant="ghost" size="md" />
          <DarkButton
            label="创建任务"
            icon={<Play size={12} />}
            onClick={handleCreate}
            variant="primary"
            size="md"
            disabled={!name.trim() || !message.trim() || saving}
            loading={saving}
          />
        </div>
      </div>
    </div>
  );
}
