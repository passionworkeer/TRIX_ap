import type { ComponentType } from 'react';
import { Info, Bot, Zap, FolderOpen, Link, Server, User, Cpu, Clock, Radio, Puzzle, Globe } from 'lucide-react';

export type SettingsTab = 'overview' | 'agents' | 'models' | 'cron' | 'skills' | 'backups' | 'pairing' | 'gateway' | 'browser' | 'channels' | 'plugins' | 'account';

interface TabConfig {
  label: string;
  icon: ComponentType<{ size?: number }>;
}

export const SETTINGS_TAB_LABELS: Record<SettingsTab, TabConfig> = {
  overview: { label: '概览', icon: Info },
  agents: { label: 'Agents', icon: Bot },
  models: { label: 'Models', icon: Cpu },
  cron: { label: '定时任务', icon: Clock },
  skills: { label: 'Skills', icon: Zap },
  backups: { label: '备份', icon: FolderOpen },
  pairing: { label: '配对码', icon: Link },
  gateway: { label: 'Gateway', icon: Server },
  browser: { label: '浏览器', icon: Globe },
  channels: { label: '频道', icon: Radio },
  plugins: { label: '插件', icon: Puzzle },
  account: { label: '账户', icon: User },
};

interface TabButtonProps {
  tab: SettingsTab;
  active: boolean;
  onClick: () => void;
}

export const TabButton = ({ tab, active, onClick }: TabButtonProps) => {
  const cfg = SETTINGS_TAB_LABELS[tab];
  const Icon = cfg.icon as ComponentType<{ size?: number }>;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 8,
        border: 'none',
        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: active ? '#e5e2e1' : '#919191',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'system-ui, sans-serif',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <Icon size={14} />
      {cfg.label}
    </button>
  );
};
