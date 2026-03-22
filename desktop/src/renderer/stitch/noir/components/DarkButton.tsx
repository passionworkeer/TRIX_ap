import React from 'react';
import { cn } from '../../shared/cn';

interface DarkButtonProps {
  label: string;
  icon?: React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  variant?: 'ghost' | 'outline' | 'primary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

const variantStyles = {
  ghost: {
    background: 'transparent',
    hover: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.05)',
    text: '#e5e2e1',
  },
  outline: {
    background: 'transparent',
    hover: 'rgba(255,255,255,0.1)',
    border: 'rgba(255,255,255,0.12)',
    text: '#e5e2e1',
  },
  primary: {
    background: 'linear-gradient(135deg, #ffffff, #d4d4d4)',
    hover: 'linear-gradient(135deg, #ffffff, #e0e0e0)',
    border: 'rgba(255,255,255,0.2)',
    text: '#1a1c1c',
  },
  danger: {
    background: 'rgba(255,68,68,0.12)',
    hover: 'rgba(255,68,68,0.2)',
    border: 'rgba(255,68,68,0.2)',
    text: '#ffb4ab',
  },
};

const sizeStyles = {
  sm: { padding: '5px 10px', fontSize: 12, gap: 4 },
  md: { padding: '8px 14px', fontSize: 13, gap: 6 },
  lg: { padding: '10px 18px', fontSize: 14, gap: 8 },
};

export const DarkButton = ({
  label,
  icon,
  onClick,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  loading = false,
  className,
  style,
  title,
}: DarkButtonProps) => {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={cn('dark-button', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        borderRadius: 8,
        border: `1px solid ${v.border}`,
        background: hovered ? v.hover : v.background,
        color: v.text,
        fontSize: s.fontSize,
        fontWeight: 500,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {loading && (
        <span
          style={{
            width: 12,
            height: 12,
            border: '1.5px solid rgba(255,255,255,0.2)',
            borderTopColor: v.text,
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            display: 'inline-block',
          }}
        />
      )}
      {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
      <span>{label}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </button>
  );
};
