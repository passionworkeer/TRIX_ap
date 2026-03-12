import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`ios-glass-surface rounded-[2rem] transition-all duration-300 hover:shadow-xl ${onClick ? 'ios-pressable cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
