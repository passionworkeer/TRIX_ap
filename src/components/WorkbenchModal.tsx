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
import { X } from 'lucide-react';
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

  // Handle card click - placeholder for now
  const handleCardClick = useCallback(
    (item: WorkbenchItem) => {
      // Call the onCardClick callback if provided
      onCardClick?.(item.id);

      // Placeholder actions - will be replaced with actual implementations
      logger.ui.debug(`[WorkbenchModal] Card clicked: ${item.id}`);

      switch (item.id) {
        case 'snapshot':
          // TODO: Open snapshot modal/camera
          logger.ui.debug('[WorkbenchModal] Opening snapshot...');
          break;
        case 'location':
          // TODO: Open location picker
          logger.ui.debug('[WorkbenchModal] Opening location picker...');
          break;
        case 'schedule':
          // TODO: Open schedule manager
          logger.ui.debug('[WorkbenchModal] Opening schedule...');
          break;
        case 'todo':
          // TODO: Open todo list
          logger.ui.debug('[WorkbenchModal] Opening todo list...');
          break;
        default:
          logger.ui.debug('[WorkbenchModal] Unknown action:', item.id);
      }

      // Close modal after action (optional, can be removed based on UX preference)
      // onClose();
    },
    [onCardClick]
  );

  // Handle backdrop click to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      // Only close if clicking the backdrop, not the content
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
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
          {/* Backdrop overlay with glassmorphism */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="工作台"
            className="fixed inset-0 z-40"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            tabIndex={-1}
          />

          {/* Cards container - positioned above GlassDock */}
          <motion.div
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
          >
            {/* Main container with glassmorphism */}
            <div
              className="relative overflow-hidden rounded-3xl p-4"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.75) 100%)',
                backdropFilter: 'blur(25px) saturate(200%)',
                WebkitBackdropFilter: 'blur(25px) saturate(200%)',
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: `
                  0 25px 50px -12px rgba(0, 0, 0, 0.2),
                  0 0 0 1px rgba(255, 255, 255, 0.4) inset,
                  0 1px 0 rgba(255, 255, 255, 0.8) inset
                `,
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 tracking-tight">
                    工作台
                  </h2>
                  <p className="text-xs text-gray-500">
                    快捷功能入口
                  </p>
                </div>

                {/* Close button */}
                <motion.button
                  onClick={onClose}
                  aria-label="关闭工作台"
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100/80 hover:bg-gray-200/80 transition-colors"
                  style={{
                    border: '1px solid rgba(0,0,0,0.05)',
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={18} className="text-gray-600" strokeWidth={2} />
                </motion.button>
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
                  ref={scrollContainerRef}
                  className="flex gap-3 overflow-x-auto pb-2 px-1 scroll-smooth"
                  style={{
                    scrollbarWidth: 'none', // Firefox
                    msOverflowStyle: 'none', // IE/Edge
                    WebkitOverflowScrolling: 'touch', // iOS smooth scroll
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
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-1 h-1 rounded-full bg-gray-400/40" />
                <span className="text-[10px] text-gray-400">
                  左右滑动查看更多
                </span>
                <div className="w-1 h-1 rounded-full bg-gray-400/40" />
              </div>

              {/* Top handle bar */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-300/50 rounded-full mt-2" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WorkbenchModal;
