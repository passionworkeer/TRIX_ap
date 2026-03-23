import React from 'react';

interface InfoRowProps {
  label: string;
  value: string;
}

export const InfoRow = ({ label, value }: InfoRowProps) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '7px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      gap: 16,
    }}
  >
    <span style={{ fontSize: 12, color: '#919191', flexShrink: 0 }}>{label}</span>
    <span
      style={{
        fontSize: value.includes('/') ? 11 : 12,
        color: '#e5e2e1',
        textAlign: 'right',
        wordBreak: 'break-all',
        fontFamily: value.includes('/') ? "'JetBrains Mono', monospace" : 'system-ui',
      }}
    >
      {value}
    </span>
  </div>
);
