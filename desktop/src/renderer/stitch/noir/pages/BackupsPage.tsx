import { useState, useEffect } from 'react';
import {
  Calendar, Filter, Trash2, Terminal, Copy, ExternalLink,
  ChevronDown, RefreshCw, CheckCircle, XCircle, Info,
} from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import { DarkTerminal, createLogEntry, type LogEntry } from '../components/DarkTerminal';

interface BackupEntry {
  id: string;
  date: string;
  description: string;
  size: string;
  status: 'success' | 'failed' | 'restoring';
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

const MOCK_BACKUPS: BackupEntry[] = [
  { id: 'BK_001', date: '2024-05-24 14:22', description: '系统自动快照 (v2.4.1)', size: '1.2 GB', status: 'success' },
  { id: 'BK_002', date: '2024-05-23 23:30', description: '例行每日备份', size: '1.1 GB', status: 'success' },
  { id: 'BK_003', date: '2024-05-22 23:30', description: '例行每日备份', size: '1.1 GB', status: 'failed' },
  { id: 'BK_004', date: '2024-05-21 23:30', description: '例行每日备份', size: '1.0 GB', status: 'success' },
  { id: 'BK_005', date: '2024-05-20 23:30', description: '例行每日备份', size: '1.1 GB', status: 'success' },
];

const STORAGE_ITEMS = [
  { label: '聊天历史记录', size: '12.4 GB', color: '#630ed4' },
  { label: '附件与文档', size: '28.1 GB', color: '#7c3aed' },
  { label: '系统配置', size: '2.3 GB', color: '#919191' },
];

function parseBackupsOutput(output: string): BackupEntry[] {
  const lines = output.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return MOCK_BACKUPS;
  // Try JSON parse first
  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through to line parsing
  }
  // Line-based fallback
  return lines
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        return {
          id: parts[0] ?? `BK_${Date.now()}`,
          date: parts[1] ?? '',
          description: parts.slice(2).join(' '),
          size: '—',
          status: line.toLowerCase().includes('fail') ? 'failed' : 'success',
        } as BackupEntry;
      }
      return null;
    })
    .filter(Boolean) as BackupEntry[];
}

const StatusBadge = ({ status }: { status: BackupEntry['status'] }) => {
  const cfg = {
    success: { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', label: '成功' },
    failed: { bg: 'rgba(255,107,107,0.1)', color: '#ff6b6b', label: '失败' },
    restoring: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', label: '恢复中' },
  }[status]!;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 999,
      fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.color,
    }}>
      {status === 'success' && <CheckCircle size={10} style={{ marginRight: 4 }} />}
      {status === 'failed' && <XCircle size={10} style={{ marginRight: 4 }} />}
      {status === 'restoring' && <RefreshCw size={10} style={{ marginRight: 4 }} />}
      {cfg.label}
    </span>
  );
};

export default function BackupsPage() {
  const [autoBackup, setAutoBackup] = useState(true);
  const [backupFreq, setBackupFreq] = useState('每天一次');
  const [retention, setRetention] = useState('保留最近 30 个版本');
  const [backups, setBackups] = useState<BackupEntry[]>(MOCK_BACKUPS);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [diskInfo, setDiskInfo] = useState<{ letter: string; total: number; free: number; used: number; usage: number }[]>([]);

  const addLog = (entry: LogEntry) =>
    setLogEntries((prev) => [...prev.slice(-99), entry]);

  const loadBackups = async () => {
    const api = window.electronAPI;
    setLoading(true);
    addLog(createLogEntry('info', '正在加载备份列表...'));
    try {
      if (api) {
        const result: CommandResult = await api.listBackups();
        if (result.success && result.stdout) {
          const parsed = parseBackupsOutput(result.stdout);
          setBackups(parsed.length > 0 ? parsed : MOCK_BACKUPS);
          addLog(createLogEntry('success', `已加载 ${parsed.length || MOCK_BACKUPS.length} 条备份记录`));
        } else {
          setBackups(MOCK_BACKUPS);
          addLog(createLogEntry('warning', '无法获取真实备份，使用演示数据'));
        }
      } else {
        setBackups(MOCK_BACKUPS);
        addLog(createLogEntry('warning', '桌面 API 不可用，显示演示数据'));
      }
    } catch (err) {
      setBackups(MOCK_BACKUPS);
      addLog(createLogEntry('error', `加载失败: ${String(err)}`));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load real disk info ─────────────────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getDiskInfo) return;
    api.getDiskInfo().then((result: { success: boolean; data?: { letter: string; total: number; free: number }[] }) => {
      if (result.success && result.data) {
        setDiskInfo(
          result.data.map((d) => {
            const used = d.total - d.free;
            return { ...d, used, usage: d.total > 0 ? Math.round((used / d.total) * 100) : 0 };
          })
        );
      }
    });
  }, []);

  const handleBackupNow = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    addLog(createLogEntry('command', '$ backup create'));
    try {
      const result: CommandResult = await api.runOpenClawCommand('backup create');
      const output = result.stdout || result.stderr || result.error || '';
      if (result.success) {
        addLog(createLogEntry('success', '备份创建成功'));
        (output.split('\n') || []).forEach((l) => { if (l.trim()) addLog(createLogEntry('output', l)); });
        await loadBackups();
      } else {
        addLog(createLogEntry('error', `备份失败: ${output || '未知错误'}`));
      }
    } catch (err) {
      addLog(createLogEntry('error', `执行失败: ${String(err)}`));
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    const api = window.electronAPI;
    setRunningId(id);
    addLog(createLogEntry('command', `$ backup restore ${id}`));
    setBackups((prev) =>
      prev.map((b) => b.id === id ? { ...b, status: 'restoring' } : b)
    );
    try {
      if (api) {
        const result: CommandResult = await api.restoreBackup(id);
        if (result.success) {
          addLog(createLogEntry('success', `备份 ${id} 还原成功`));
        } else {
          addLog(createLogEntry('error', `还原失败: ${result.stderr || result.error}`));
        }
      } else {
        await new Promise((r) => setTimeout(r, 2000));
        addLog(createLogEntry('success', `[演示] 备份 ${id} 还原完成`));
      }
    } catch (err) {
      addLog(createLogEntry('error', `还原失败: ${String(err)}`));
    } finally {
      setRunningId(null);
      await loadBackups();
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#131313', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px 16px' }}>
        {/* Editorial Header */}
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#630ed4', marginBottom: 4, display: 'block' }}>
            Data Continuity
          </span>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#e5e2e1', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            数据备份与恢复
          </h1>
          <p style={{ fontSize: 13, color: '#919191', lineHeight: 1.7, maxWidth: 600, margin: 0 }}>
            确保您的 TRIX Companion 数据始终安全。管理自动备份计划，查看存档历史记录，或通过命令行界面执行高级系统恢复。
          </p>
        </div>

        {/* Grid: auto backup + storage */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, marginBottom: 16 }}>
          {/* Auto Backup Settings */}
          <DarkCard elevation="low" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #630ed4, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,14,212,0.3)' }}>
                  <Calendar size={20} color="#fff" />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#e5e2e1' }}>自动备份设置</span>
              </div>
              <button
                onClick={() => setAutoBackup(!autoBackup)}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: autoBackup ? '#630ed4' : 'rgba(255,255,255,0.08)',
                  border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3,
                  [autoBackup ? 'left' : 'right']: 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'all 0.2s',
                }} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#919191', letterSpacing: '0.1em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>备份频率</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={backupFreq}
                    onChange={(e) => setBackupFreq(e.target.value)}
                    style={{ width: '100%', padding: '10px 36px 10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 13, color: '#e5e2e1', appearance: 'none' as const, outline: 'none', cursor: 'pointer', fontFamily: 'system-ui' }}
                  >
                    <option style={{ background: '#201f1f' }}>每小时</option>
                    <option style={{ background: '#201f1f' }}>每天一次</option>
                    <option style={{ background: '#201f1f' }}>每周一次</option>
                    <option style={{ background: '#201f1f' }}>每月一次</option>
                  </select>
                  <ChevronDown size={14} color="#919191" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#919191', letterSpacing: '0.1em', textTransform: 'uppercase' as const, display: 'block', marginBottom: 8 }}>保留策略</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={retention}
                    onChange={(e) => setRetention(e.target.value)}
                    style={{ width: '100%', padding: '10px 36px 10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 13, color: '#e5e2e1', appearance: 'none' as const, outline: 'none', cursor: 'pointer', fontFamily: 'system-ui' }}
                  >
                    <option style={{ background: '#201f1f' }}>保留最近 7 个版本</option>
                    <option style={{ background: '#201f1f' }}>保留最近 30 个版本</option>
                    <option style={{ background: '#201f1f' }}>无限保留</option>
                  </select>
                  <ChevronDown size={14} color="#919191" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, background: 'rgba(99,14,212,0.08)', border: '1px solid rgba(99,14,212,0.2)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Info size={14} color="#630ed4" style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#d2bbff', marginBottom: 2 }}>下次预定备份</div>
                <div style={{ fontSize: 11, color: '#919191' }}>今天, 23:30 (GMT+8) · 将同步至：iCloud Drive / local_storage</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <DarkButton
                label={loading ? '备份中...' : '立即备份'}
                icon={<Calendar size={13} />}
                onClick={handleBackupNow}
                variant="primary"
                size="md"
                disabled={loading}
                loading={loading}
              />
              <DarkButton
                label="修改路径"
                onClick={() => addLog(createLogEntry('info', '路径配置功能开发中'))}
                variant="outline"
                size="md"
              />
            </div>
          </DarkCard>

          {/* Storage Usage */}
          <DarkCard elevation="low" style={{ padding: 28 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e5e2e1', margin: '0 0 24px' }}>存储使用情况</h3>
            {diskInfo.length > 0 ? (
              diskInfo.map((disk) => {
                const fmt = (bytes: number) => {
                  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
                  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
                  return `${(bytes / 1e6).toFixed(0)} MB`;
                };
                return (
                  <div key={disk.letter} style={{ marginBottom: diskInfo.indexOf(disk) < diskInfo.length - 1 ? 20 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#919191', marginRight: 6 }}>{disk.letter}:</span>
                        <span style={{ fontSize: 22, fontWeight: 700, color: '#e5e2e1' }}>{fmt(disk.total - disk.free)}</span>
                        <span style={{ fontSize: 12, color: '#919191', marginLeft: 4 }}>/ {fmt(disk.total)}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#630ed4' }}>{disk.usage}%</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${disk.usage}%`, borderRadius: 5, background: 'linear-gradient(90deg, #630ed4, #7c3aed)', transition: 'width 0.5s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, marginBottom: diskInfo.indexOf(disk) < diskInfo.length - 1 ? 16 : 0 }}>
                      <span style={{ fontSize: 11, color: '#4ade80' }}>可用 {fmt(disk.free)}</span>
                      <span style={{ fontSize: 11, color: '#919191' }}>已用 {fmt(disk.used)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: '0%', borderRadius: 5, background: 'rgba(99,14,212,0.3)' }} />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, marginTop: 8 }}>
              {STORAGE_ITEMS.map((item) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#919191', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, display: 'inline-block', flexShrink: 0 }} />
                    {item.label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e5e2e1' }}>{item.size}</span>
                </div>
              ))}
            </div>

            <button style={{ marginTop: 24, width: '100%', padding: '11px', background: 'rgba(255,255,255,0.04)', color: '#919191', fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, cursor: 'pointer', fontFamily: 'system-ui', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Trash2 size={14} />
              清理旧备份
            </button>
          </DarkCard>
        </div>

        {/* Backup History Table */}
        <DarkCard elevation="low" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ padding: '18px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e5e2e1', margin: 0 }}>备份历史记录</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <DarkButton
                label="刷新"
                icon={<RefreshCw size={13} />}
                onClick={loadBackups}
                variant="outline"
                size="sm"
                disabled={loading}
              />
              <button style={{ fontSize: 11, fontWeight: 600, color: '#630ed4', background: 'rgba(99,14,212,0.08)', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'system-ui' }}>
                <Filter size={12} />
                筛选结果
              </button>
            </div>
          </div>

          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {(['备份日期', '描述', '大小', '状态', '操作'] as const).map((h) => (
                  <th key={h} style={{ padding: '12px 28px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#919191' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backups.map((entry) => (
                <tr key={entry.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '16px 28px', fontSize: 13, fontWeight: 500, color: '#e5e2e1', fontFamily: "'JetBrains Mono', monospace" }}>{entry.date}</td>
                  <td style={{ padding: '16px 28px', fontSize: 13, color: '#919191' }}>{entry.description}</td>
                  <td style={{ padding: '16px 28px', fontSize: 13, color: '#919191', fontFamily: "'JetBrains Mono', monospace" }}>{entry.size}</td>
                  <td style={{ padding: '16px 28px' }}><StatusBadge status={entry.status} /></td>
                  <td style={{ padding: '16px 28px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleRestore(entry.id)}
                      disabled={runningId === entry.id || entry.status === 'failed'}
                      style={{ fontSize: 12, fontWeight: 600, color: entry.status === 'failed' ? '#919191' : '#630ed4', background: 'none', border: 'none', cursor: entry.status === 'failed' ? 'default' : 'pointer', fontFamily: 'system-ui', opacity: runningId === entry.id ? 0.6 : 1 }}
                    >
                      {runningId === entry.id ? '还原中...' : entry.status === 'failed' ? '重试' : '还原'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DarkCard>

        {/* CLI Recovery Mode */}
        <div style={{ background: '#0e0e0e', borderRadius: 16, padding: 28, display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 32, border: '1px solid rgba(255,255,255,0.04)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Terminal size={22} color="#630ed4" />
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e5e2e1', margin: 0 }}>CLI 恢复模式</h3>
            </div>
            <p style={{ fontSize: 12, color: '#919191', lineHeight: 1.7, margin: '0 0 24px' }}>
              在极端情况下，如 UI 无法访问，您可以通过终端使用 TRIX CLI 恢复您的数据。请确保您具备系统管理员权限。
            </p>
            <a href="#" style={{ fontSize: 11, fontWeight: 600, color: '#630ed4', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              查看完整文档 <ExternalLink size={12} />
            </a>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: '检查连接状态', cmd: 'trix-cli status --check-backups' },
              { label: '从快照还原', cmd: 'trix-cli restore --id <SNAPSHOT_ID> --force' },
            ].map((item) => (
              <div key={item.label} style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#919191' }}>{item.label}</span>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(item.cmd); addLog(createLogEntry('info', `已复制: ${item.cmd}`)); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#919191' }}
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#e5e2e1' }}>
                  $ <span style={{ color: '#630ed4' }}>trix-cli</span> {item.cmd.split('trix-cli ')[1]}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 20, paddingTop: 4 }}>
              <span style={{ fontSize: 10, color: '#919191', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={12} color="#4ade80" /> 已验证内核版本 1.2.0+
              </span>
              <span style={{ fontSize: 10, color: '#919191', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={12} color="#fbbf24" /> 还原将覆盖本地更改
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal log */}
      <div style={{ height: 180, padding: '0 48px 24px', flexShrink: 0 }}>
        <DarkTerminal entries={logEntries} autoScroll maxEntries={200} />
      </div>
    </div>
  );
}
