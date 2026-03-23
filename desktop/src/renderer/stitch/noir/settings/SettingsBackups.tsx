import { useState, useCallback } from 'react';
import { Download, RefreshCw, RotateCcw, Clock } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

interface BackupEntry {
  id: string;
  date: string;
  size: string;
  description?: string;
}

function parseBackupList(stdout: string): BackupEntry[] {
  try {
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.backups && Array.isArray(parsed.backups)) return parsed.backups;
  } catch { /* fall through */ }
  // Line-based fallback: "id  date  size  description"
  return stdout
    .split('\n')
    .filter(l => l.trim() && !l.includes('No backup'))
    .map(l => {
      const parts = l.trim().split(/\s+/);
      return {
        id: parts[0] || '',
        date: parts[1] || '',
        size: parts[2] || '',
        description: parts.slice(3).join(' ') || undefined,
      };
    })
    .filter(b => b.id);
}

export function SettingsBackups(props: SettingsSharedState) {
  const { runningCommand } = props;
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadBackups = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.listBackups();
      const output = result.stdout || result.stderr || result.error || '';
      const list = parseBackupList(output);
      setBackups(list);
      setLoaded(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateBackup = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setError(null);
    setResultMsg(null);
    setLoading(true);
    try {
      const result = await api.runOpenClawCommand('backup create');
      const msg = result.success
        ? `备份创建成功: ${result.stdout.trim()}`
        : `创建失败: ${result.stderr || result.error}`;
      setResultMsg(msg);
      if (result.success) await loadBackups();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [loadBackups]);

  const handleRestore = useCallback(async (backupId: string) => {
    const api = window.electronAPI;
    if (!api) return;
    setRestoring(backupId);
    setError(null);
    setResultMsg(null);
    try {
      const result = await api.restoreBackup(backupId);
      setResultMsg(result.success
        ? `已恢复到备份: ${backupId}`
        : `恢复失败: ${result.stderr || result.error}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setRestoring(null);
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 12 }}>{error}</div>
      )}
      {resultMsg && (
        <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, color: '#4ade80', fontSize: 12 }}>{resultMsg}</div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <DarkButton
          label="刷新备份列表"
          icon={<RefreshCw size={12} />}
          onClick={loadBackups}
          variant="outline"
          size="md"
          disabled={loading}
          loading={loading}
        />
        <DarkButton
          label="创建备份"
          icon={<Download size={12} />}
          onClick={handleCreateBackup}
          variant="primary"
          size="md"
          disabled={runningCommand || loading}
          loading={runningCommand}
        />
      </div>

      {/* Backup List */}
      {loaded && backups.length === 0 ? (
        <DarkCard elevation="low">
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#555', fontSize: 13 }}>
            暂无备份记录
          </div>
        </DarkCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {backups.map(backup => (
            <DarkCard key={backup.id} elevation="low">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Download size={15} color="#818cf8" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1', fontFamily: 'monospace' }}>{backup.id}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 3, fontSize: 11, color: '#919191' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={10} />{backup.date || '—'}
                    </span>
                    {backup.size && <span>{backup.size}</span>}
                    {backup.description && <span>{backup.description}</span>}
                  </div>
                </div>
                <DarkButton
                  label="恢复"
                  icon={<RotateCcw size={11} />}
                  onClick={() => handleRestore(backup.id)}
                  variant="outline"
                  size="sm"
                  disabled={restoring === backup.id}
                  loading={restoring === backup.id}
                />
              </div>
            </DarkCard>
          ))}
        </div>
      )}

      {/* Info */}
      <DarkCard elevation="low">
        <div style={{ fontSize: 12, color: '#919191', lineHeight: 1.7 }}>
          <strong style={{ color: '#e5e2e1' }}>备份说明</strong><br />
          备份包含 OpenClaw 配置文件、Skills 和 cron 任务设置。<br />
          恢复操作会覆盖当前配置，请谨慎操作。
        </div>
      </DarkCard>
    </div>
  );
}
