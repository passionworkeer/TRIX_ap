import { CheckCircle, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  installed: boolean;
  label: string;
}

export const StatusBadge = ({ installed, label }: StatusBadgeProps) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: installed ? 'rgba(74,222,128,0.1)' : 'rgba(255,107,107,0.1)',
      color: installed ? '#4ade80' : '#ff6b6b',
      border: `1px solid ${installed ? 'rgba(74,222,128,0.2)' : 'rgba(255,107,107,0.2)'}`,
    }}
  >
    {installed ? <CheckCircle size={12} /> : <XCircle size={12} />}
    {label}
  </div>
);
