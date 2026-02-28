/**
 * WorkbenchCard - Single workbench feature card component
 *
 * Used in WorkbenchModal for quick access to features like snapshot, location, schedule, todo
 */

import React from 'react';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';

interface WorkbenchCardProps {
  /** Lucide icon name (e.g., 'Camera', 'MapPin', 'Calendar', 'CheckSquare') */
  icon: string;
  /** Card label text */
  label: string;
  /** Tailwind gradient color class (e.g., 'from-pink-500 to-rose-500') */
  color: string;
  /** Click handler */
  onClick: () => void;
  /** Optional aria-label for accessibility */
  ariaLabel?: string;
}

/**
 * Dynamically get Lucide icon component by name
 */
const getIconComponent = (iconName: string): React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }> => {
  const IconComponent = (LucideIcons as Record<string, unknown>)[iconName];
  if (typeof IconComponent === 'function') {
    return IconComponent as React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  }
  // Fallback to a default icon if not found
  return LucideIcons.Sparkles;
};

const WorkbenchCard: React.FC<WorkbenchCardProps> = ({
  icon,
  label,
  color,
  onClick,
  ariaLabel,
}) => {
  const IconComponent = getIconComponent(icon);

  return (
    <motion.button
      onClick={onClick}
      aria-label={ariaLabel || label}
      className="flex-shrink-0 w-20 h-24 flex flex-col items-center justify-center gap-2 rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)`,
        backdropFilter: 'blur(10px) saturate(150%)',
        WebkitBackdropFilter: 'blur(10px) saturate(150%)',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: `
          0 4px 16px rgba(0, 0, 0, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.4)
        `,
      }}
      whileHover={{
        scale: 1.05,
        y: -2,
        transition: {
          type: 'spring',
          stiffness: 400,
          damping: 25,
        },
      }}
      whileTap={{
        scale: 0.95,
        transition: {
          type: 'spring',
          stiffness: 500,
          damping: 30,
        },
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 25,
      }}
    >
      {/* Icon container with gradient background */}
      <div
        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}
        style={{
          boxShadow: `
            0 4px 12px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.3)
          `,
        }}
      >
        <IconComponent
          size={24}
          className="text-white drop-shadow-sm"
          strokeWidth={2}
        />
      </div>

      {/* Label */}
      <span
        className="text-xs font-medium text-gray-700 tracking-tight"
        style={{
          textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
        }}
      >
        {label}
      </span>
    </motion.button>
  );
};

export default WorkbenchCard;
