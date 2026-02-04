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
      className={`bg-white/40 backdrop-blur-xl border border-white/40 shadow-lg rounded-[2rem] ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassPanel;