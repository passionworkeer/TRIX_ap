import React from 'react';

const C = {
  primary: '#630ed4',
  onPrimary: '#ffffff',
  surfaceLowest: '#ffffff',
  onSurface: '#191c1e',
  onSurfaceVariant: '#4a4455',
};

export interface LuminaTabBarProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onChange: (key: string) => void;
}

export const LuminaTabBar: React.FC<LuminaTabBarProps> = ({ tabs, activeTab, onChange }) => (
  <nav style={{ display: 'flex', gap: 2 }}>
    {tabs.map((tab) => (
      <button
        key={tab.key}
        onClick={() => onChange(tab.key)}
        style={{
          padding: '7px 16px',
          borderRadius: '8px 8px 0 0',
          border: 'none',
          borderBottom: `2px solid ${activeTab === tab.key ? C.primary : 'transparent'}`,
          background: activeTab === tab.key ? C.surfaceLowest : 'transparent',
          color: activeTab === tab.key ? C.primary : C.onSurfaceVariant,
          fontSize: 13,
          fontWeight: activeTab === tab.key ? 600 : 500,
          cursor: 'pointer',
          transition: 'all 0.15s',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {tab.label}
      </button>
    ))}
  </nav>
);
