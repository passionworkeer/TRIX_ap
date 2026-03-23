import { useState, useEffect, useCallback } from 'react';
import { Monitor, Bell, BellOff, Eye, EyeOff, Save } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

interface SystemSettings {
  autostart: boolean;
  notifications: {
    enabled: boolean;
    mentionOnly: boolean;
    sound: boolean;
    unreadBadge: boolean;
  };
}

export function SettingsSystem(_props: SettingsSharedState) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Autostart
  const [autostart, setAutostart] = useState(false);

  // Notifications
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifMentionOnly, setNotifMentionOnly] = useState(false);
  const [notifSound, setNotifSound] = useState(true);
  const [notifBadge, setNotifBadge] = useState(true);

  const loadSettings = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    setLoading(true);
    try {
      const result = await api.getAutostart();
      if (result.success && result.data) {
        setAutostart(result.data.enabled);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveAutostart = useCallback(async (enabled: boolean) => {
    const api = window.electronAPI;
    if (!api) return;
    try {
      const result = await api.setAutostart(enabled);
      if (result.success) {
        setAutostart(enabled);
        setSuccessMsg(enabled ? '已设置为开机启动' : '已取消开机启动');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(result.error || '保存失败');
      }
    } catch {
      setError('保存失败');
    }
  }, []);

  if (loading) return <div style={{ color: '#919191', fontSize: 13 }}>加载中...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 8, color: '#ff6b6b', fontSize: 12 }}>{error}</div>
      )}
      {successMsg && (
        <div style={{ padding: '8px 12px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 8, color: '#4ade80', fontSize: 12 }}>{successMsg}</div>
      )}

      {/* Autostart */}
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Monitor size={15} color="#e5e2e1" />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>开机启动</div>
        </div>
        <ToggleRow
          label="开机自动启动"
          description="登录 Windows 时自动启动 TRIX Companion"
          checked={autostart}
          onChange={saveAutostart}
        />
      </DarkCard>

      {/* Notifications */}
      <DarkCard elevation="low">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          {notifEnabled
            ? <Bell size={15} color="#e5e2e1" />
            : <BellOff size={15} color="#919191" />
          }
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>通知</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow
            label="启用通知"
            description="收到消息时显示系统通知"
            checked={notifEnabled}
            onChange={setNotifEnabled}
          />
          {notifEnabled && (
            <>
              <ToggleRow
                label="仅提及通知"
                description="只通知 @trix/@TRIX/@openclaw 提及我的消息"
                checked={notifMentionOnly}
                onChange={setNotifMentionOnly}
              />
              <ToggleRow
                label="通知声音"
                description="收到通知时播放提示音"
                checked={notifSound}
                onChange={setNotifSound}
              />
              <ToggleRow
                label="未读角标"
                description="在任务栏显示未读消息数量"
                checked={notifBadge}
                onChange={setNotifBadge}
              />
            </>
          )}
        </div>
      </DarkCard>

      {/* System Tray hint */}
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 10 }}>系统托盘</div>
        <div style={{ fontSize: 12, color: '#919191', lineHeight: 1.7 }}>
          关闭窗口时，TRIX Companion 会在系统托盘保持运行。<br />
          点击托盘图标可重新打开主窗口，右键菜单可退出程序。
        </div>
      </DarkCard>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#e5e2e1' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#919191', marginTop: 1 }}>{description}</div>
      </div>
      <div
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={() => onChange(!checked)}
      >
        {checked
          ? <Eye size={22} color="#4ade80" />
          : <EyeOff size={22} color="#555" />
        }
      </div>
    </div>
  );
}
