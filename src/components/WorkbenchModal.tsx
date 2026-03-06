/**
 * WorkbenchModal - Home dashboard modal with feature cards
 *
 * Horizontal scrollable card list for quick access to:
 * - Snapshot (camera/album)
 * - Location (share location)
 * - Schedule (calendar events)
 * - Todo (task management)
 */

import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera } from 'lucide-react';
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showSnapshotPanel, setShowSnapshotPanel] = useState(false);

  // Handle camera button click
  const handleCameraClick = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  // Handle file selection from camera
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const imageUri = URL.createObjectURL(file);
        // Call onCardClick with snapshot id, parent component handles the image
        onCardClick?.('snapshot');
        logger.ui.debug('[WorkbenchModal] Image captured:', imageUri);
      }
      // Reset input value to allow selecting the same file again
      e.target.value = '';
    },
    [onCardClick]
  );

  // Handle card click - placeholder for now
  const handleCardClick = useCallback(
    (item: WorkbenchItem) => {
      // Call the onCardClick callback if provided
      onCardClick?.(item.id);

      // Placeholder actions - will be replaced with actual implementations
      logger.ui.debug(`[WorkbenchModal] Card clicked: ${item.id}`);

      switch (item.id) {
        case 'snapshot':
          // Open embedded snapshot panel
          setShowSnapshotPanel(true);
          logger.ui.debug('[WorkbenchModal] Opening snapshot panel...');
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

                {/* Embedded Snapshot Panel */}
                <AnimatePresence mode="wait">
                  {showSnapshotPanel ? (
                    <motion.div
                      key="snapshot-panel"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 30,
                      }}
                      className="flex flex-col items-center justify-center py-4 px-2"
                    >
                      {/* Hidden file inputs */}
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                      />

                      {/* Compact camera button with skeuomorphic design */}
                      <div className="flex items-center gap-4">
                        {/* Small camera button */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleCameraClick}
                          className="relative w-16 h-16 flex-shrink-0"
                          aria-label="打开相机"
                        >
                          {/* Outer ring - metallic */}
                          <div
                            className="absolute inset-0 rounded-full"
                            style={{
                              background:
                                'linear-gradient(145deg, #e6e6e6 0%, #c0c0c0 50%, #a0a0a0 100%)',
                              boxShadow:
                                '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.8)',
                            }}
                          />
                          {/* Inner ring - black */}
                          <div
                            className="absolute inset-1 rounded-full"
                            style={{
                              background:
                                'linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)',
                            }}
                          />
                          {/* Lens - blue gradient */}
                          <div
                            className="absolute inset-2 rounded-full overflow-hidden"
                            style={{
                              background:
                                'radial-gradient(circle at 30% 30%, rgba(100,150,255,0.5) 0%, rgba(50,100,200,0.3) 40%, rgba(20,50,100,0.7) 100%)',
                            }}
                          >
                            {/* Lens reflection */}
                            <div
                              className="absolute top-1 left-1 w-3 h-2 rounded-full opacity-60"
                              style={{
                                background:
                                  'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 100%)',
                                transform: 'rotate(-45deg)',
                              }}
                            />
                          </div>
                          {/* Camera icon */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Camera
                              size={16}
                              className="text-white/90 drop-shadow-md"
                              strokeWidth={1.5}
                            />
                          </div>
                          {/* Flash effect on tap */}
                          <motion.div
                            className="absolute inset-0 rounded-full bg-white"
                            initial={{ opacity: 0 }}
                            whileTap={{ opacity: 0.4 }}
                            transition={{ duration: 0.1 }}
                            style={{ pointerEvents: 'none' }}
                          />
                        </motion.button>

                        {/* Close button */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowSnapshotPanel(false)}
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100/80 hover:bg-gray-200/80 transition-colors"
                          style={{
                            border: '1px solid rgba(0,0,0,0.05)',
                          }}
                          aria-label="返回工作台"
                        >
                          <X size={18} className="text-gray-600" strokeWidth={2} />
                        </motion.button>
                      </div>

                      {/* Hint text */}
                      <p className="text-xs text-gray-500 mt-3">
                        点击相机按钮拍照
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="cards-container"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      ref={scrollContainerRef}
                      className="flex gap-4 overflow-x-auto pb-2 px-1 pt-1 scroll-smooth"
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
                    </motion.div>
                  )}
                </AnimatePresence>
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
