/**
 * Deprecated compatibility wrapper.
 * Prefer `useConfirmModal` + `ConfirmModal` for new code.
 */

import React from 'react';
import ConfirmModal, { ConfirmModalVariant } from './ui/ConfirmModal';
import { useConfirmModal } from '../hooks/useConfirmModal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmModalVariant;
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'warning',
  isProcessing,
  onConfirm,
  onCancel,
}) => {
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title}
      message={message}
      confirmText={confirmText}
      cancelText={cancelText}
      variant={variant}
      isProcessing={isProcessing}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
};

export const useConfirm = () => {
  const { requestConfirm, ConfirmModalRenderer } = useConfirmModal();

  const ask = (
    title: string,
    message: string,
    variant: ConfirmModalVariant = 'warning'
  ) => {
    return requestConfirm({ title, message, variant });
  };

  return {
    confirm: ask,
    ConfirmDialog: ConfirmModalRenderer,
  };
};
