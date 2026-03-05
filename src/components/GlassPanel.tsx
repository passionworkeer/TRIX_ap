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
      className={`bg-white/40 dark:bg-white/10 backdrop-blur-xl border border-white/40 dark:border-white/20 shadow-lg rounded-[2rem] transition-all duration-300 hover:shadow-xl hover:bg-white/50 dark:hover:bg-white/15 ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
