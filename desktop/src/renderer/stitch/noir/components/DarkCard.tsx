import React from 'react';
import { cn } from '../../shared/cn';

interface DarkCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Glassmorphism variant — adds backdrop blur + translucent background
   * @default false
   */
  glass?: boolean;
  /**
   * Elevation level — maps to surface-container-* hierarchy
   * @default 'container'
   */
  elevation?: 'lowest' | 'low' | 'container' | 'high' | 'highest';
  /**
   * Hover effect — subtle scale + brightness shift
   * @default false
   */
  hoverable?: boolean;
  onClick?: () => void;
}

const elevationStyles = {
  lowest: { background: '#0e0e0e', borderColor: 'rgba(71,71,71,0.3)' },
  low: { background: '#1c1b1b', borderColor: 'rgba(71,71,71,0.3)' },
  container: { background: '#201f1f', borderColor: 'rgba(71,71,71,0.3)' },
  high: { background: '#2a2a2a', borderColor: 'rgba(71,71,71,0.3)' },
  highest: { background: '#353534', borderColor: 'rgba(71,71,71,0.3)' },
};

export const DarkCard = ({
  children,
  className,
  style,
  glass = false,
  elevation = 'container',
  hoverable = false,
  onClick,
}: DarkCardProps) => {
  const base = elevationStyles[elevation];

  return (
    <div
      onClick={onClick}
      className={cn('dark-card', className)}
      style={{
        background: glass
          ? 'rgba(53, 53, 52, 0.4)'
          : base.background,
        backdropFilter: glass ? 'blur(20px)' : undefined,
        WebkitBackdropFilter: glass ? 'blur(20px)' : undefined,
        border: '1px solid rgba(255,255,255,0.05)',
        borderColor: glass ? 'rgba(255,255,255,0.05)' : base.borderColor,
        borderRadius: 16,
        padding: 20,
        cursor: onClick ? 'pointer' : 'default',
        transition: hoverable || onClick ? 'all 0.2s ease' : undefined,
        boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable || onClick) {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 40px rgba(0,0,0,0.4)';
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable || onClick) {
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 30px rgba(0,0,0,0.3)';
        }
      }}
    >
      {children}
      <style>{`
        .dark-card::-webkit-scrollbar { width: 4px; }
        .dark-card::-webkit-scrollbar-thumb { background: #353534; border-radius: 10px; }
      `}</style>
    </div>
  );
};
