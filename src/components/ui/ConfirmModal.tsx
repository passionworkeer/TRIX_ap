import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import Modal from './Modal';

export type ConfirmModalVariant = 'danger' | 'warning' | 'info';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmModalVariant;
  isProcessing?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const variantTokens: Record<
  ConfirmModalVariant,
  {
    icon: React.ReactNode;
    panelClass: string;
    confirmClass: string;
  }
> = {
  danger: {
    icon: <AlertTriangle className="h-8 w-8 text-red-500 dark:text-red-400" />,
    panelClass:
      'border-red-200/70 bg-white/90 dark:border-red-900/60 dark:bg-slate-900/90',
    confirmClass:
      'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  },
  warning: {
    icon: <AlertTriangle className="h-8 w-8 text-amber-500 dark:text-amber-400" />,
    panelClass:
      'border-amber-200/70 bg-white/90 dark:border-amber-900/60 dark:bg-slate-900/90',
    confirmClass:
      'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500',
  },
  info: {
    icon: <Info className="h-8 w-8 text-blue-500 dark:text-blue-400" />,
    panelClass:
      'border-blue-200/70 bg-white/90 dark:border-blue-900/60 dark:bg-slate-900/90',
    confirmClass:
      'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
  },
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'warning',
  isProcessing = false,
  onConfirm,
  onCancel,
}) => {
  const token = variantTokens[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      labelledBy="confirm-modal-title"
      describedBy="confirm-modal-message"
      className={`ios-glass-surface relative z-[1002] w-full max-w-md rounded-[1.75rem] border p-5 shadow-2xl ${token.panelClass}`}
    >
      <button
        type="button"
        onClick={onCancel}
        className="ios-pressable ios-icon-button-compact ios-surface-button absolute right-3 top-3 flex items-center justify-center p-1.5 text-slate-400 dark:text-slate-300"
        aria-label="关闭确认弹窗"
        disabled={isProcessing}
      >
        <X size={18} />
      </button>

      <div className="mb-4 flex items-center gap-3 pr-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          {token.icon}
        </div>
        <h3
          id="confirm-modal-title"
          className="text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          {title}
        </h3>
      </div>

      <p
        id="confirm-modal-message"
        className="mb-5 whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300"
      >
        {message}
      </p>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="ios-pressable ios-surface-button rounded-xl px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-200"
        >
          {cancelText}
        </button>
        <button
          type="button"
          onClick={() => {
            void onConfirm();
          }}
          disabled={isProcessing}
          className={`ios-pressable ios-primary-button rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900 ${token.confirmClass}`}
        >
          {isProcessing ? '处理中...' : confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
