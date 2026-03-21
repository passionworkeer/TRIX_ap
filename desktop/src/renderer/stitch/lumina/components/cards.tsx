import React from 'react';

// ---------------------------------------------------------------------------
// SurfaceCard
// ---------------------------------------------------------------------------

type SurfaceCardElevation = 'low' | 'mid' | 'high';

interface SurfaceCardProps {
  elevation?: SurfaceCardElevation;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

const ELEVATION_STYLES: Record<SurfaceCardElevation, React.CSSProperties> = {
  low: {
    background: '#f2f4f6',
    borderRadius: 12,
    border: '1px solid #e6e8ea',
  },
  mid: {
    background: '#eceef0',
    borderRadius: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  high: {
    background: '#eceef0',
    borderRadius: 12,
    border: '1px solid #e6e8ea',
    boxShadow: '0 4px 16px rgba(0,0,0,0.09)',
  },
};

export const SurfaceCard = (props: SurfaceCardProps) => {
  const { elevation = 'low', children, style, className } = props;

  return (
    <div
      className={className}
      style={{
        ...ELEVATION_STYLES[elevation],
        padding: 16,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
