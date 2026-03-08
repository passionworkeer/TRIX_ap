/**
 * WorkbenchModal - Home dashboard modal with feature cards
 *
 * Horizontal scrollable card list for quick access to:
 * - Snapshot (camera/album)
 * - Location (share location)
 * - Schedule (calendar events)
 * - Todo (task management)
 */

import React, { useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import WorkbenchCard from './WorkbenchCard';
import { logger } from '../utils/logger';
import { DEFAULT_WORKBENCH_ITEMS, WorkbenchItem } from '../types/workbench';

interface WorkbenchModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Custom workbench items (optional, defaults to DEFAULT_WORKBENCH_ITEMS) */
  items?: WorkbenchItem[];
  /** Callback when a card is clicked, receives the item id */
  onCardClick?: (itemId: string) => void;
}

const WorkbenchModal: React.FC<WorkbenchModalProps> = ({
  isOpen,
  onClose,
  items = DEFAULT_WORKBENCH_ITEMS,
  onCardClick,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Handle card click
  const handleCardClick = useCallback(
    (item: WorkbenchItem) => {
      // Call the onCardClick callback if provided
      onCardClick?.(item.id);

      logger.ui.debug(`[WorkbenchModal] Card clicked: ${item.id}`);

      switch (item.id) {
        case 'snapshot':
        case 'location':
        case 'schedule':
        case 'todo':
          // Close workbench modal for external panels
          onClose();
          break;
        default:
          logger.ui.debug('[WorkbenchModal] Unknown action:', item.id);
      }
    },
    [onCardClick, onClose]
  );

  // Handle keyboard escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Cards container - positioned above GlassDock */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="工作台"
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                type: 'spring',
                stiffness: 300,
                damping: 25,
                mass: 0.8,
              },
            }}
            exit={{
              opacity: 0,
              y: 40,
              scale: 0.95,
              transition: {
                type: 'spring',
                stiffness: 400,
                damping: 30,
              },
            }}
            style={{
              position: 'fixed',
              left: '1rem',
              right: '1rem',
              margin: '0 auto',
              // Positioned above GlassDock (bottom: 2rem, height: 68px)
              bottom: 'calc(2rem + 80px)',
              maxWidth: '420px',
              zIndex: 50,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            {/* Main container with glassmorphism */}
            <div
              className="relative overflow-hidden rounded-[2rem] p-5 pb-4"
              style={{
                background: 'rgba(250, 250, 250, 0.75)',
                backdropFilter: 'blur(30px) saturate(180%)',
                WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                boxShadow: `
                  0 24px 48px -12px rgba(0, 0, 0, 0.15),
                  inset 0 1px 1px rgba(255, 255, 255, 0.8),
                  inset 0 0 0 1px rgba(255, 255, 255, 0.5)
                `,
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 px-2">
                <div>
                  <h2 className="text-[1.125rem] font-bold text-gray-800/90 tracking-tight leading-none mb-1">
                    工作台
                  </h2>
                  <p className="text-[0.75rem] text-gray-500/80 font-medium">
                    快捷功能入口
                  </p>
                </div>
              </div>

              {/* Scrollable cards container with fade indicators */}
              <div className="relative">
                {/* Left fade indicator */}
                <div
                  className="absolute left-0 top-0 bottom-2 w-4 z-10 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.95), transparent)',
                  }}
                />

                {/* Right fade indicator */}
                <div
                  className="absolute right-0 top-0 bottom-2 w-4 z-10 pointer-events-none"
                  style={{
                    background: 'linear-gradient(-90deg, rgba(255,255,255,0.95), transparent)',
                  }}
                />

                <div
                  className="flex gap-4 overflow-x-auto pb-2 px-1 pt-1 scroll-smooth"
                  ref={scrollContainerRef}
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        transition: {
                          delay: index * 0.05,
                          type: 'spring',
                          stiffness: 300,
                          damping: 25,
                        },
                      }}
                    >
                      <WorkbenchCard
                        icon={item.icon}
                        label={item.label}
                        color={item.color}
                        onClick={() => handleCardClick(item)}
                        ariaLabel={item.label}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Bottom hint */}
              <div className="flex items-center justify-center gap-2 mt-4 opacity-60">
                <div className="w-[3px] h-[3px] rounded-full bg-gray-400" />
                <span className="text-[10px] font-medium text-gray-500 tracking-wider uppercase">
                  左右滑动查看更多
                </span>
                <div className="w-[3px] h-[3px] rounded-full bg-gray-400" />
              </div>

              {/* Top handle bar */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-full opacity-60" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WorkbenchModal;
