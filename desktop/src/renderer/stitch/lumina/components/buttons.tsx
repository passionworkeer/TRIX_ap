import React from 'react';
import { Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// LuminaButton
// ---------------------------------------------------------------------------

type LuminaButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
type LuminaButtonSize = 'sm' | 'md' | 'lg';

interface LuminaButtonProps {
  variant?: LuminaButtonVariant;
  size?: LuminaButtonSize;
  icon?: React.ReactNode;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const BASE_BUTTON: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontWeight: 600,
  transition: 'all 0.15s ease',
  outline: 'none',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

const SIZE_STYLES: Record<LuminaButtonSize, React.CSSProperties> = {
  sm: { padding: '5px 12px', fontSize: 12 },
  md: { padding: '8px 18px', fontSize: 13.5 },
  lg: { padding: '11px 24px', fontSize: 15 },
};

const VARIANT_STYLES: Record<
  LuminaButtonVariant,
  { default: React.CSSProperties; hover: React.CSSProperties; active: React.CSSProperties }
> = {
  primary: {
    default: {
      background: '#630ed4',
      color: '#ffffff',
      boxShadow: '0 1px 3px rgba(99,14,212,0.25)',
    },
    hover: {
      background: '#5611b8',
      boxShadow: '0 2px 8px rgba(99,14,212,0.35)',
    },
    active: {
      background: '#4709a0',
      boxShadow: '0 0 0 2px rgba(99,14,212,0.15)',
    },
  },
  secondary: {
    default: {
      background: '#eceef0',
      color: '#191c1e',
    },
    hover: {
      background: '#e6e8ea',
      color: '#191c1e',
    },
    active: {
      background: '#dfe1e3',
      color: '#191c1e',
    },
  },
  ghost: {
    default: {
      background: 'transparent',
      color: '#630ed4',
    },
    hover: {
      background: '#eceef0',
      color: '#5611b8',
    },
    active: {
      background: '#e6e8ea',
      color: '#4709a0',
    },
  },
  outline: {
    default: {
      background: 'transparent',
      color: '#4a4455',
      border: '1px solid #ccc3d8',
    },
    hover: {
      background: '#eceef0',
      color: '#191c1e',
      border: '1px solid #b8afc7',
    },
    active: {
      background: '#e6e8ea',
      color: '#191c1e',
      border: '1px solid #a89bb8',
    },
  },
};

export const LuminaButton = (props: LuminaButtonProps) => {
  const {
    variant = 'primary',
    size = 'md',
    icon,
    label,
    loading = false,
    disabled = false,
    onClick,
  } = props;

  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  const isDisabled = disabled || loading;

  const handleClick = () => {
    if (!isDisabled) onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      style={{
        ...BASE_BUTTON,
        ...variantStyle.default,
        ...sizeStyle,
        opacity: isDisabled && !loading ? 0.45 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          const el = e.currentTarget as HTMLButtonElement;
          Object.assign(el.style, variantStyle.hover);
        }
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          const el = e.currentTarget as HTMLButtonElement;
          Object.assign(el.style, variantStyle.default);
        }
      }}
      onMouseDown={(e) => {
        if (!isDisabled) {
          const el = e.currentTarget as HTMLButtonElement;
          Object.assign(el.style, variantStyle.active);
        }
      }}
      onMouseUp={(e) => {
        if (!isDisabled) {
          const el = e.currentTarget as HTMLButtonElement;
          Object.assign(el.style, variantStyle.hover);
        }
      }}
      title={label}
    >
      {loading ? (
        <Loader2
          size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14}
          style={{ animation: 'lumina-spin 0.8s linear infinite' }}
        />
      ) : (
        icon && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )
      )}
      <span>{label}</span>
      <style>{`
        @keyframes lumina-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
};
