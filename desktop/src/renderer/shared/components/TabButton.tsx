import React from 'react';

export type SettingsTab = 'overview' | 'agents' | 'skills' | 'backups' | 'pairing' | 'gateway' | 'account';

interface TabConfig {
  label: string;
  icon: React.ElementType;
}

export const SETTINGS_TAB_LABELS: Record<SettingsTab, TabConfig> = {
  overview: { label: '概览', icon: require('lucide-react').Info },
  agents: { label: 'Agents', icon: require('lucide-react').Bot },
  skills: { label: 'Skills', icon: require('lucide-react').Zap },
  backups: { label: '备份', icon: require('lucide-react').FolderOpen },
  pairing: { label: '配对码', icon: require('lucide-react').Link },
  gateway: { label: 'Gateway', icon: require('lucide-react').Server },
  account: { label: '账户', icon: require('lucide-react').User },
};

interface TabButtonProps {
  tab: SettingsTab;
  active: boolean;
  onClick: () => void;
}

export const TabButton = ({ tab, active, onClick }: TabButtonProps) => {
  const cfg = SETTINGS_TAB_LABELS[tab];
  const Icon = cfg.icon as React.ComponentType<{ size?: number }>;
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
