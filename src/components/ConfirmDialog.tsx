/**
 * 确认对话框组件 - Confirm Dialog
 * 用于替换原生的 window.confirm()
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';

export type ConfirmVariant = 'warning' | 'danger' | 'info';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles = {
  warning: {
    icon: <AlertTriangle className="w-12 h-12 text-orange-500" />,
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    confirmBg: 'bg-orange-500 hover:bg-orange-600',
  },
  danger: {
    icon: <AlertTriangle className="w-12 h-12 text-red-500" />,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    confirmBg: 'bg-red-500 hover:bg-red-600',
  },
  info: {
    icon: <Info className="w-12 h-12 text-blue-500" />,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    confirmBg: 'bg-blue-500 hover:bg-blue-600',
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'warning',
  onConfirm,
  onCancel,
}) => {
  const styles = variantStyles[variant];
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // 自动聚焦确认按钮
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [isOpen]);

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onCancel}
          />

          {/* 对话框 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className={`${styles.bgColor} rounded-3xl shadow-2xl max-w-md w-full border-2 ${styles.borderColor} overflow-hidden`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 顶部关闭按钮 */}
              <div className="flex justify-end p-4">
                <button
                  onClick={onCancel}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="关闭"
                >
                  <X size={20} />
                </button>
              </div>

              {/* 内容区域 */}
              <div className="px-8 pb-8">
                {/* 图标 */}
                <div className="flex justify-center mb-4">
                  {styles.icon}
                </div>

                {/* 标题 */}
                <h3 className="text-xl font-bold text-gray-900 text-center mb-3">
                  {title}
                </h3>

                {/* 消息 */}
                <p className="text-gray-700 text-center mb-8 whitespace-pre-line">
                  {message}
                </p>

                {/* 按钮组 */}
                <div className="flex gap-3">
                  <button
                    onClick={onCancel}
                    className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-2xl transition-colors"
                  >
                    {cancelText}
                  </button>
                  <button
                    ref={confirmButtonRef}
                    onClick={onConfirm}
                    className={`flex-1 px-6 py-3 ${styles.confirmBg} text-white font-semibold rounded-2xl transition-colors`}
                  >
                    {confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * useConfirm Hook - 提供确认对话框功能
 */
export const useConfirm = () => {
  const [dialogState, setDialogState] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: ConfirmVariant;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'warning',
    resolve: null,
  });

  const confirm = (
    title: string,
    message: string,
    variant: ConfirmVariant = 'warning'
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        title,
        message,
        variant,
        resolve,
      });
    });
  };

  const handleConfirm = () => {
    dialogState.resolve?.(true);
    setDialogState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handleCancel = () => {
    dialogState.resolve?.(false);
    setDialogState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      isOpen={dialogState.isOpen}
      title={dialogState.title}
      message={dialogState.message}
      variant={dialogState.variant}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
};
