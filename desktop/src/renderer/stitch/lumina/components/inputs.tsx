import React, { useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// LuminaInput
// ---------------------------------------------------------------------------

type LuminaInputType = 'text' | 'password' | 'email';

interface LuminaInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: LuminaInputType;
  icon?: React.ReactNode;
  error?: string;
}

export const LuminaInput = (props: LuminaInputProps) => {
  const { label, placeholder, value, onChange, type = 'text', icon, error } = props;

  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasError = Boolean(error);
  const borderColor = hasError
    ? '#ba1a1a'
    : focused
    ? '#630ed4'
    : 'transparent';
  const borderTransition = 'border-color 0.15s ease, box-shadow 0.15s ease';

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {label && (
        <label
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: hasError ? '#ba1a1a' : '#4a4455',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            transition: 'color 0.15s ease',
          }}
        >
          {label}
        </label>
      )}

      <div
        onClick={handleContainerClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#eceef0',
          borderRadius: 8,
          padding: '0 12px',
          borderBottom: `2px solid ${borderColor}`,
          boxShadow: focused && !hasError ? `0 2px 8px rgba(99,14,212,0.12)` : 'none',
          transition: borderTransition,
          cursor: 'text',
          boxSizing: 'border-box',
        }}
      >
        {icon && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              color: hasError ? '#ba1a1a' : focused ? '#630ed4' : '#7b7487',
              transition: 'color 0.15s ease',
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}

        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '10px 0',
            fontSize: 13.5,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#191c1e',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {hasError && (
        <span
          style={{
            fontSize: 11,
            color: '#ba1a1a',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 500,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
};
