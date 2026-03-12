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
import { iosBackdropMotion, iosQuickSpring, iosSheetMotion } from '../utils/iosMotion';

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
          <motion.div
            className="fixed inset-0 z-[60] bg-black/8 backdrop-blur-[3px]"
            aria-hidden="true"
            onClick={onClose}
            {...iosBackdropMotion}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="工作台"
            {...iosSheetMotion}
            style={{
              position: 'fixed',
              left: '1rem',
              right: '1rem',
              margin: '0 auto',
              bottom: 'calc(1.75rem + 86px)',
              maxWidth: '420px',
              zIndex: 61,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            <div
              className="ios-glass-surface relative overflow-hidden rounded-[2.15rem] p-5 pb-4"
              style={{
                boxShadow: `
                  0 28px 54px rgba(15, 23, 42, 0.18),
                  inset 0 1px 0 rgba(255, 255, 255, 0.8),
                  inset 0 -1px 0 rgba(255, 255, 255, 0.16)
                `,
              }}
            >
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

              <div className="relative">
                <div
                  className="absolute left-0 top-0 bottom-2 w-4 z-10 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.96), transparent)',
                  }}
                />

                <div
                  className="absolute right-0 top-0 bottom-2 w-4 z-10 pointer-events-none"
                  style={{
                    background: 'linear-gradient(-90deg, rgba(255,255,255,0.96), transparent)',
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
                          ...iosQuickSpring,
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

              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1 bg-gray-300 rounded-full opacity-60" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WorkbenchModal;
