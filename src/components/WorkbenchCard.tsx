/**
 * WorkbenchCard - Single workbench feature card component
 *
 * Used in WorkbenchModal for quick access to features like snapshot, location, schedule, todo
 */

import React from 'react';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { iosPressableMotion } from '../utils/iosMotion';

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
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      className="ios-pressable ios-glass-surface flex h-24 w-20 flex-shrink-0 flex-col items-center justify-center gap-3 rounded-[1.4rem] cursor-pointer focus:outline-none"
      style={{
        boxShadow: `
          0 14px 28px rgba(15, 23, 42, 0.08),
          inset 0 1px 0 rgba(255, 255, 255, 0.76)
        `,
      }}
      {...iosPressableMotion}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
    >
      {/* Icon container with gradient background */}
      <div
        className={`w-12 h-12 rounded-[1rem] bg-gradient-to-br ${color} flex items-center justify-center`}
        style={{
          boxShadow: `
            0 10px 18px rgba(15, 23, 42, 0.18),
            inset 0 1px 1px rgba(255, 255, 255, 0.42)
          `,
        }}
      >
        <IconComponent
          size={22}
          className="text-white"
          strokeWidth={2}
        />
      </div>

      {/* Label */}
      <span
        className="text-[12px] font-medium text-gray-700/90 tracking-wide"
      >
        {label}
      </span>
    </motion.button>
  );
};

export default WorkbenchCard;
