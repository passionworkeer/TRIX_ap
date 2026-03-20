import React, { useState } from 'react';
import { MessageSquare, Send, Users, Smartphone, Slack, MessageCircle, Hash, Wifi } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  fields: { label: string; placeholder: string; type: string }[];
  configured: boolean;
}

const CHANNELS: Channel[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: '#0088cc',
    description: '连接 Telegram Bot，接收私聊和群组消息',
    fields: [
      { label: 'Bot Token', placeholder: '123456:ABC-DEF...', type: 'password' },
    ],
    configured: false,
  },
  {
    id: 'feishu',
    name: '飞书 (Feishu)',
    icon: MessageSquare,
    color: '#4263eb',
    description: '使用 WebSocket 连接飞书应用',
    fields: [
      { label: 'App ID', placeholder: 'cli_xxxxxxxxxx', type: 'text' },
      { label: 'App Secret', placeholder: '••••••••••••••••', type: 'password' },
    ],
    configured: false,
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: Hash,
    color: '#5865f2',
    description: '将 Agent 接入 Discord 服务器和频道',
    fields: [
      { label: 'Bot Token', placeholder: 'MTIz...', type: 'password' },
    ],
    configured: false,
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: Slack,
    color: '#4a154b',
    description: '在 Slack 工作区中与 Agent 对话',
    fields: [
      { label: 'Bot Token', placeholder: 'xoxb-...', type: 'password' },
    ],
    configured: false,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: Smartphone,
    color: '#25d366',
    description: '通过 WhatsApp 连接手机端消息',
    fields: [
      { label: '手机号', placeholder: '+86 138...', type: 'tel' },
    ],
    configured: false,
  },
  {
    id: 'wechat-work',
    name: '企业微信',
    icon: Users,
    color: '#07c160',
    description: '接入企业微信，支持自建应用',
    fields: [
      { label: 'Corp ID', placeholder: 'ww...', type: 'text' },
      { label: 'Agent ID', placeholder: '1000001', type: 'text' },
    ],
    configured: false,
  },
];

function ChannelCard({ channel, isActive, onClick }: { channel: Channel; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        border: `1px solid ${isActive ? channel.color + '44' : 'rgba(255,255,255,0.06)'}`,
        background: isActive ? `${channel.color}0d` : 'rgba(255,255,255,0.03)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${channel.color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <channel.icon size={20} color={channel.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{channel.name}</div>
        <div style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel.description}</div>
      </div>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: channel.configured ? '#22c55e' : 'rgba(255,255,255,0.15)',
          flexShrink: 0,
        }}
      />
    </button>
  );
}

export default function OpenClawChannels() {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(CHANNELS[0]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        background: 'var(--bg-primary)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Left: Channel List */}
      <div
        style={{
          width: 300,
          borderRight: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MessageCircle size={16} color="#818cf8" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>消息渠道</span>
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            {CHANNELS.filter((c) => c.configured).length} / {CHANNELS.length} 已配置
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {CHANNELS.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              isActive={selectedChannel?.id === channel.id}
              onClick={() => setSelectedChannel(channel)}
            />
          ))}
        </div>
      </div>

      {/* Right: Channel Config */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!selectedChannel ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
            选择渠道进行配置
          </div>
        ) : (
          <>
            {/* Channel Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `${selectedChannel.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <selectedChannel.icon size={22} color={selectedChannel.color} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>{selectedChannel.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{selectedChannel.description}</div>
              </div>
              <div
                style={{
                  marginLeft: 'auto',
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: selectedChannel.configured ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                  color: selectedChannel.configured ? '#22c55e' : '#64748b',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {selectedChannel.configured ? '已配置' : '未配置'}
              </div>
            </div>

            {/* Config Form */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              {/* Status Banner */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  marginBottom: 24,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <Wifi size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                  <strong style={{ color: '#f1f5f9' }}>渠道配置说明</strong>
                  <br />
                  渠道配置需要重启 Gateway 生效。配置完成后请在「桌面设置」中重启 Gateway。
                  <br />
                  <code
                    style={{
                      display: 'inline-block',
                      marginTop: 8,
                      padding: '2px 8px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: 4,
                      fontFamily: 'ui-monospace, monospace',
                      fontSize: 11,
                      color: '#818cf8',
                    }}
                  >
                    openclaw channels configure {selectedChannel.id}
                  </code>
                </div>
              </div>

              {/* Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedChannel.fields.map((field) => (
                  <div key={field.label}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#94a3b8',
                        marginBottom: 6,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {field.label}
                    </label>
                    <input
                      type={field.type === 'password' ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={fieldValues[field.label] || ''}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.label]: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        color: '#e2e8f0',
                        fontSize: 14,
                        fontFamily: 'system-ui',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = selectedChannel.color + '66')}
                      onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                    />
                  </div>
                ))}
              </div>

              {/* Save Button */}
              <div style={{ marginTop: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    border: 'none',
                    background: selectedChannel.color,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                    transition: 'all 0.15s',
                    fontFamily: 'system-ui',
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) e.currentTarget.style.filter = 'brightness(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'none';
                  }}
                >
                  {saved ? '✓ 已保存' : saving ? '保存中...' : '保存配置'}
                </button>
                {saved && (
                  <span style={{ fontSize: 12, color: '#22c55e' }}>
                    请重启 Gateway 使配置生效
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
