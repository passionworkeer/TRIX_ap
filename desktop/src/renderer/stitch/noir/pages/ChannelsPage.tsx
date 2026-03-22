import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, Send, Users, MessageSquare, Phone,
  Building2, Trash2, Loader, CheckCircle2, XCircle,
} from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import { DarkTerminal, createLogEntry, type LogEntry } from '../components/DarkTerminal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChannelConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  configured: boolean;
  config?: Record<string, string>;
}

type ChannelStatus = 'connected' | 'disconnected' | 'pending' | 'error';

interface Channel extends ChannelConfig {
  icon: React.ElementType;
  color: string;
  description: string;
  status: ChannelStatus;
}

// ─── Channel Definitions ─────────────────────────────────────────────────────

const CHANNEL_DEFS: Array<{
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  fields: Array<{ key: string; label: string; placeholder: string; secret?: boolean }>;
}> = [
  {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: '#26a5e4',
    description: '跨平台即时通讯，支持 Bot API',
    fields: [
      { key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...', secret: true },
    ],
  },
  {
    id: 'feishu',
    name: '飞书',
    icon: MessageSquare,
    color: '#3370ff',
    description: '字节跳动企业通讯平台，支持机器人与消息收发',
    fields: [
      { key: 'appId',     label: 'App ID',     placeholder: 'cli_xxxxxxxxxx' },
      { key: 'appSecret', label: 'App Secret', placeholder: '输入飞书 App Secret', secret: true },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: Users,
    color: '#5865f2',
    description: '社区与游戏语音平台，支持 Webhook',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/...' },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: MessageCircle,
    color: '#4a154b',
    description: '企业协作工具，支持 Slack App',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...' },
      { key: 'channel',    label: 'Channel',     placeholder: '#general' },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: Phone,
    color: '#25d366',
    description: 'Meta 即时通讯，支持 WhatsApp Business API',
    fields: [
      { key: 'phoneNumber', label: 'Phone Number',    placeholder: '+86xxxxxxxxxxx' },
      { key: 'instanceId',  label: 'Instance ID',     placeholder: 'Instance ID' },
      { key: 'apiToken',     label: 'API Token',       placeholder: 'API Token', secret: true },
    ],
  },
  {
    id: 'wecom',
    name: '企业微信',
    icon: Building2,
    color: '#07c160',
    description: '腾讯企业级通讯，支持企业自建应用',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://qyapi.weixin.qq.com/...' },
      { key: 'corpId',     label: 'Corp ID',     placeholder: 'wwxxxxxxxxxxxxxx' },
      { key: 'agentId',    label: 'Agent ID',    placeholder: '1000001' },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function channelDef(id: string) {
  return CHANNEL_DEFS.find((d) => d.id === id)!;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  connected:    { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  label: '已连接' },
  disconnected: { color: '#919191', bg: 'rgba(145,145,145,0.1)', label: '未连接' },
  pending:      { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  label: '配置中' },
  error:        { color: '#ff6b6b', bg: 'rgba(255,107,107,0.1)',  label: '连接错误' },
};

const StatusBadge = ({ status }: { status: ChannelStatus }) => {
  const cfg = STATUS_COLORS[status]!; // STATUS_COLORS covers all ChannelStatus values
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color }} />
      {cfg.label}
    </div>
  );
};

const ChannelCard = ({
  channel,
  selected,
  onClick,
}: {
  channel: Channel;
  selected: boolean;
  onClick: () => void;
}) => {
  const def = channelDef(channel.id);
  const Icon = def.icon as React.ComponentType<{ size?: number; color?: string }>;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 12,
        border: selected ? `1px solid ${channel.color}40` : '1px solid rgba(255,255,255,0.06)',
        background: selected ? `${channel.color}0d` : 'rgba(255,255,255,0.02)',
        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)';
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${channel.color}18`, border: `1px solid ${channel.color}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color={channel.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1', marginBottom: 2 }}>
          {channel.name}
        </div>
        <div style={{
          fontSize: 11, color: '#919191', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {channel.description}
        </div>
      </div>
      <StatusBadge status={channel.status} />
    </button>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<string>(CHANNEL_DEFS[0]!.id);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  // formValues keyed by channelId
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  // visiblePasswords tracks which secret fields are revealed
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const api = window.electronAPI;

  const addLog = useCallback((entry: LogEntry) =>
    setLogEntries((prev) => [...prev.slice(-149), entry]), []);

  const selectedChannel = channels.find((c) => c.id === selectedId) ?? channels[0];
  const selectedDef = channelDef(selectedId);
  const currentValues = formValues[selectedId] ?? {};

  // Load channels from IPC on mount
  useEffect(() => {
    addLog(createLogEntry('info', '渠道配置面板已就绪'));
    if (!api) { addLog(createLogEntry('error', 'electronAPI 不可用')); return; }

    api.channelsList().then((result) => {
      if (result.success && result.data) {
        const merged: Channel[] = result.data.map((ch) => {
          const def = CHANNEL_DEFS.find((d) => d.id === ch.id);
          return {
            ...ch,
            icon: def?.icon ?? MessageCircle,
            color: def?.color ?? '#919191',
            description: def?.description ?? '',
            status: ch.configured ? 'connected' : 'disconnected',
          };
        });
        setChannels(merged);

        // Pre-populate form values from saved config
        const vals: Record<string, Record<string, string>> = {};
        for (const ch of result.data) {
          vals[ch.id] = { ...(ch.config ?? {}) };
        }
        setFormValues(vals);

        addLog(createLogEntry('success', `已加载 ${result.data.length} 个渠道配置`));
      } else {
        addLog(createLogEntry('error', `加载渠道失败: ${result.error}`));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFieldChange = (key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [selectedId]: { ...(prev[selectedId] ?? {}), [key]: value },
    }));
  };

  const handleSave = async () => {
    if (!api || saving) return;
    const config = currentValues;
    setSaving(true);
    addLog(createLogEntry('warning', `[${selectedDef.name}] 保存配置...`));

    try {
      const result = await api.channelsConfigure(selectedId, config);
      if (result.success) {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === selectedId
              ? { ...c, configured: true, enabled: true, status: 'connected' as ChannelStatus }
              : c,
          ));
        addLog(createLogEntry('success', `[${selectedDef.name}] 配置已保存`));
      } else {
        addLog(createLogEntry('error', `保存失败: ${result.error}`));
      }
    } catch (e) {
      addLog(createLogEntry('error', `保存异常: ${String(e)}`));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!api || testing) return;
    const config = currentValues;
    setTesting(true);
    addLog(createLogEntry('warning', `[${selectedDef.name}] 测试连接...`));

    setChannels((prev) =>
      prev.map((c) =>
        c.id === selectedId ? { ...c, status: 'pending' as ChannelStatus } : c,
      ));

    try {
      const result = await api.channelsTest(selectedId, config);
      if (result.success) {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === selectedId ? { ...c, status: 'connected' as ChannelStatus } : c,
          ));
        addLog(createLogEntry('success', `[${selectedDef.name}] ${result.message ?? '连接成功'}`));
      } else {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === selectedId ? { ...c, status: 'error' as ChannelStatus } : c,
          ));
        addLog(createLogEntry('error', `[${selectedDef.name}] ${result.message ?? result.error ?? '连接失败'}`));
      }
    } catch (e) {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === selectedId ? { ...c, status: 'error' as ChannelStatus } : c,
        ));
      addLog(createLogEntry('error', `测试异常: ${String(e)}`));
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!api) return;
    const confirmed = confirm(`确定要删除 ${selectedDef.name} 配置吗？`);
    if (!confirmed) return;

    const result = await api.channelsDelete(selectedId);
    if (result.success) {
      setChannels((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, configured: false, enabled: false, status: 'disconnected' as ChannelStatus }
            : c,
        ));
      setFormValues((prev) => {
        const next = { ...prev };
        delete next[selectedId];
        return next;
      });
      addLog(createLogEntry('success', `[${selectedDef.name}] 配置已删除`));
    } else {
      addLog(createLogEntry('error', `删除失败: ${result.error}`));
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#131313', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 28px 16px', flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e5e2e1', margin: 0, letterSpacing: '-0.02em' }}>
            渠道配置
          </h1>
          <p style={{ fontSize: 12, color: '#919191', margin: '4px 0 0' }}>
            管理 TRIX Companion 的第三方消息渠道
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {channels.filter((c) => c.configured).length > 0 && (
            <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>
              {channels.filter((c) => c.configured).length} 个已连接
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{
        display: 'flex', flex: 1, overflow: 'hidden',
        padding: '0 28px 16px', gap: 16,
      }}>
        {/* Channel list */}
        <div style={{
          width: 280, flexShrink: 0, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: '#919191', margin: '0 0 6px', paddingLeft: 2,
          }}>
            可用渠道
          </p>
          {channels.map((ch) => (
            <ChannelCard
              key={ch.id}
              channel={ch}
              selected={selectedId === ch.id}
              onClick={() => setSelectedId(ch.id)}
            />
          ))}
        </div>

        {/* Config panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {selectedChannel ? (
            <>
              {/* Channel header + form */}
              <DarkCard elevation="low" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  {(() => {
                    const Icon = selectedDef.icon as React.ComponentType<{ size?: number; color?: string }>;
                    return (
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: `${selectedDef.color}18`,
                        border: `1px solid ${selectedDef.color}28`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={20} color={selectedDef.color} />
                      </div>
                    );
                  })()}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#e5e2e1' }}>
                      {selectedDef.name}
                    </div>
                    <div style={{ fontSize: 12, color: '#919191', marginTop: 2 }}>
                      {selectedDef.description}
                    </div>
                  </div>
                  <StatusBadge status={selectedChannel.status} />
                </div>

                {/* Form fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedDef.fields.map((field) => {
                    const value = currentValues[field.key] ?? '';
                    const inputKey = `${selectedId}:${field.key}`;
                    return (
                      <FormField
                        key={field.key}
                        label={field.label}
                        placeholder={field.placeholder}
                        value={value}
                        secret={field.secret}
                        visible={visiblePasswords[inputKey] ?? false}
                        onChange={(v) => handleFieldChange(field.key, v)}
                        onToggleVisibility={() => togglePasswordVisibility(inputKey)}
                      />
                    );
                  })}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                  <DarkButton
                    icon={saving ? <Loader size={13} /> : <CheckCircle2 size={13} />}
                    label={saving ? '保存中...' : '保存配置'}
                    onClick={handleSave}
                    variant="primary"
                    size="md"
                    disabled={saving || testing}
                  />
                  <DarkButton
                    icon={testing ? <Loader size={13} /> : <CheckCircle2 size={13} />}
                    label={testing ? '测试中...' : '测试连接'}
                    onClick={handleTest}
                    variant="outline"
                    size="md"
                    disabled={saving || testing}
                  />
                  {selectedChannel.configured && (
                    <DarkButton
                      icon={<Trash2 size={13} />}
                      label="删除配置"
                      onClick={handleDelete}
                      variant="ghost"
                      size="md"
                    />
                  )}
                </div>
              </DarkCard>

              {/* Log */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <DarkTerminal entries={logEntries} autoScroll maxEntries={150} />
              </div>
            </>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#919191', fontSize: 14,
            }}>
              加载中...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

const FormField = ({
  label, placeholder, value, secret, visible,
  onChange, onToggleVisibility,
}: {
  label: string;
  placeholder: string;
  value: string;
  secret?: boolean;
  visible?: boolean;
  onChange: (v: string) => void;
  onToggleVisibility: () => void;
}) => (
  <div>
    <label style={{
      display: 'block', fontSize: 11, fontWeight: 600, color: '#919191',
      marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      <input
        type={secret && !visible ? 'password' : 'text'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: secret ? '8px 36px 8px 12px' : '8px 12px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, fontSize: 13, color: '#e5e2e1',
          fontFamily: "'JetBrains Mono', monospace",
          outline: 'none', boxSizing: 'border-box', transition: 'border 0.15s',
        }}
        onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(129,140,248,0.4)'; }}
        onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
      />
      {secret && (
        <button
          type="button"
          onClick={onToggleVisibility}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#919191', display: 'flex', alignItems: 'center', padding: 2,
          }}
          title={visible ? '隐藏' : '显示'}
        >
          {visible ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
        </button>
      )}
    </div>
  </div>
);
