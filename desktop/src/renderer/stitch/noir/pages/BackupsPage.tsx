import { useState } from 'react';
import {
  Calendar, Filter, Trash2, Terminal, Copy, ExternalLink,
  ChevronDown, RefreshCw, CheckCircle, XCircle, Info,
} from 'lucide-react';
import { DarkCard } from '../components/DarkCard';

interface BackupEntry {
  id: string;
  date: string;
  description: string;
  size: string;
  status: 'success' | 'failed' | 'restoring';
}

const BACKUP_HISTORY: BackupEntry[] = [
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

const StatusBadge = ({ status }: { status: BackupEntry['status'] }) => {
  const cfg = {
    success: { bg: 'rgba(74,222,128,0.1)', color: '#4ade80', label: '成功' },
    failed: { bg: 'rgba(255,107,107,0.1)', color: '#ff6b6b', label: '失败' },
    restoring: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', label: '恢复中' },
  }[status];
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
  const [running, setRunning] = useState(false);

  const usedPct = 42;

  const handleBackupNow = async () => {
    setRunning(true);
    await new Promise((r) => setTimeout(r, 2000));
    setRunning(false);
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#131313', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ padding: '32px 48px 48px', maxWidth: 1100 }}>
        {/* Editorial Header */}
        <div style={{ marginBottom: 40 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, marginBottom: 24 }}>
          {/* Auto Backup Settings */}
          <DarkCard elevation="low" style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #630ed4, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,14,212,0.3)' }}>
                  <Calendar size={20} color="#fff" />
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#e5e2e1' }}>自动备份设置</span>
              </div>
              {/* Toggle */}
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

            {/* Next backup info */}
            <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, background: 'rgba(99,14,212,0.08)', border: '1px solid rgba(99,14,212,0.2)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <Info size={14} color="#630ed4" style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#d2bbff', marginBottom: 2 }}>下次预定备份</div>
                <div style={{ fontSize: 11, color: '#919191' }}>今天, 23:30 (GMT+8) · 将同步至：iCloud Drive / local_storage</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleBackupNow}
                disabled={running}
                style={{ padding: '10px 20px', borderRadius: 10, background: 'linear-gradient(135deg, #630ed4, #7c3aed)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: running ? 'wait' : 'pointer', fontFamily: 'system-ui', boxShadow: '0 4px 16px rgba(99,14,212,0.25)', opacity: running ? 0.7 : 1 }}
              >
                {running ? '备份中...' : '立即备份'}
              </button>
              <button style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', color: '#e5e2e1', fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontFamily: 'system-ui' }}>
                修改路径
              </button>
            </div>
          </DarkCard>

          {/* Storage Usage */}
          <DarkCard elevation="low" style={{ padding: 28 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e5e2e1', margin: '0 0 24px' }}>存储使用情况</h3>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#e5e2e1' }}>42.8 GB</span>
                  <span style={{ fontSize: 12, color: '#919191', marginLeft: 4 }}>/ 100 GB</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#630ed4' }}>{usedPct}%</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '42%', borderRadius: 5, background: 'linear-gradient(90deg, #630ed4, #7c3aed)', transition: 'width 0.5s ease' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
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
        <DarkCard elevation="low" style={{ padding: 0, marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '18px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e5e2e1', margin: 0 }}>备份历史记录</h3>
            <button style={{ fontSize: 11, fontWeight: 600, color: '#630ed4', background: 'rgba(99,14,212,0.08)', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'system-ui' }}>
              <Filter size={12} />
              筛选结果
            </button>
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
              {BACKUP_HISTORY.map((entry) => (
                <tr key={entry.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '16px 28px', fontSize: 13, fontWeight: 500, color: '#e5e2e1', fontFamily: "'JetBrains Mono', monospace" }}>{entry.date}</td>
                  <td style={{ padding: '16px 28px', fontSize: 13, color: '#919191' }}>{entry.description}</td>
                  <td style={{ padding: '16px 28px', fontSize: 13, color: '#919191', fontFamily: "'JetBrains Mono', monospace" }}>{entry.size}</td>
                  <td style={{ padding: '16px 28px' }}><StatusBadge status={entry.status} /></td>
                  <td style={{ padding: '16px 28px', textAlign: 'right' }}>
                    <button style={{ fontSize: 12, fontWeight: 600, color: entry.status === 'failed' ? '#919191' : '#630ed4', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'system-ui' }}>
                      {entry.status === 'failed' ? '重试' : '还原'}
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
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#919191' }}>
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
    </div>
  );
}
