import React, { useState, useEffect } from 'react';
import {
  MessageCircle, Send, Users, MessageSquare, Phone,
  Building2, Plus, Settings2, RefreshCw, Check, X,
  Wifi, WifiOff, AlertCircle, Copy,
} from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import { DarkTerminal, createLogEntry, type LogEntry } from '../components/DarkTerminal';

interface Channel {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  description: string;
  status: 'connected' | 'disconnected' | 'pending' | 'error';
  config?: Record<string, string>;
}

const CHANNELS: Channel[] = [
  {
    id: 'feishu',
    name: '飞书',
    icon: MessageSquare,
    color: '#3370ff',
    description: '字节跳动企业通讯平台，支持机器人与消息收发',
    status: 'disconnected',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: Send,
    color: '#26a5e4',
    description: '跨平台即时通讯，支持 Bot API',
    status: 'disconnected',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: Users,
    color: '#5865f2',
    description: '社区与游戏语音平台，支持 Webhook',
    status: 'disconnected',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: MessageCircle,
    color: '#4a154b',
    description: '企业协作工具，支持 Slack App',
    status: 'disconnected',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: Phone,
    color: '#25d366',
    description: 'Meta 即时通讯，支持 WhatsApp Business API',
    status: 'disconnected',
  },
  {
    id: 'wecom',
    name: '企业微信',
    icon: Building2,
    color: '#07c160',
    description: '腾讯企业级通讯，支持企业自建应用',
    status: 'disconnected',
  },
];

const StatusBadge = ({ status }: { status: Channel['status'] }) => {
  const cfg = {
    connected: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', label: '已连接' },
    disconnected: { color: '#919191', bg: 'rgba(145,145,145,0.1)', label: '未连接' },
    pending: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', label: '配置中' },
    error: { color: '#ff6b6b', bg: 'rgba(255,107,107,0.1)', label: '连接错误' },
  }[status];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}30`,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: cfg.color,
        }}
      />
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
  const Icon = channel.icon;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        border: selected
          ? `1px solid ${channel.color}40`
          : '1px solid rgba(255,255,255,0.06)',
        background: selected
          ? `${channel.color}0d`
          : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)';
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${channel.color}18`,
          border: `1px solid ${channel.color}28`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={channel.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1', marginBottom: 2 }}>
          {channel.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#919191',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {channel.description}
        </div>
      </div>
      <StatusBadge status={channel.status} />
    </button>
  );
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>(CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<Channel>(CHANNELS[0]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  const addLog = (entry: LogEntry) =>
    setLogEntries((prev) => [...prev.slice(-99), entry]);

  useEffect(() => {
    addLog(createLogEntry('info', '渠道配置面板已就绪'));
  }, []);

  const handleConnect = async () => {
    addLog(createLogEntry('warning', `[${selectedChannel.name}] 正在建立连接...`));
    // Simulate connection flow
    setTimeout(() => {
      addLog(createLogEntry('error', `[${selectedChannel.name}] 连接失败: 需要配置 API 凭证`));
      setChannels((prev) =>
        prev.map((c) =>
          c.id === selectedChannel.id ? { ...c, status: 'error' as const } : c,
        ),
      );
    }, 1000);
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#131313',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 28px 16px',
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: '#e5e2e1',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            渠道配置
          </h1>
          <p style={{ fontSize: 12, color: '#919191', margin: '4px 0 0' }}>
            管理 TRIX Companion 的消息渠道
          </p>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          padding: '0 28px 16px',
          gap: 16,
        }}
      >
        {/* Channel list */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#919191',
              margin: '0 0 6px',
              paddingLeft: 2,
            }}
          >
            可用渠道
          </p>
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              selected={selectedChannel.id === channel.id}
              onClick={() => setSelectedChannel(channel)}
            />
          ))}
        </div>

        {/* Config panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {/* Channel header */}
          <DarkCard elevation="low" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              {(() => {
                const Icon = selectedChannel.icon;
                return (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: `${selectedChannel.color}18`,
                      border: `1px solid ${selectedChannel.color}28`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={20} color={selectedChannel.color} />
                  </div>
                );
              })()}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#e5e2e1' }}>
                  {selectedChannel.name}
                </div>
                <div style={{ fontSize: 12, color: '#919191', marginTop: 2 }}>
                  {selectedChannel.description}
                </div>
              </div>
              <StatusBadge status={selectedChannel.status} />
            </div>

            {/* Config form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FormField label="API Token" placeholder={`输入 ${selectedChannel.name} Bot Token`} />
              <FormField label="Webhook URL" placeholder="https://..." />
              {selectedChannel.id === 'feishu' && (
                <FormField label="App ID" placeholder="飞书应用 App ID" />
              )}
              {selectedChannel.id === 'telegram' && (
                <FormField label="Bot Token" placeholder="123456:ABC-DEF..." />
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <DarkButton
                icon={<Plus size={13} />}
                label="连接"
                onClick={handleConnect}
                variant="primary"
                size="md"
              />
              <DarkButton
                icon={<Settings2 size={13} />}
                label="保存配置"
                onClick={() => addLog(createLogEntry('success', `[${selectedChannel.name}] 配置已保存`))}
                variant="outline"
                size="md"
              />
            </div>
          </DarkCard>

          {/* Log */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <DarkTerminal entries={logEntries} autoScroll maxEntries={150} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple form field component
const FormField = ({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) => (
  <div>
    <label
      style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        color: '#919191',
        marginBottom: 5,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </label>
    <input
      type="text"
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        fontSize: 13,
        color: '#e5e2e1',
        fontFamily: "'JetBrains Mono', monospace",
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border 0.15s',
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(129,140,248,0.4)';
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)';
      }}
    />
  </div>
);
