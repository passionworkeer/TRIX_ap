import { useCallback, useState } from 'react';
import ConfirmModal, { ConfirmModalVariant } from '../components/ui/ConfirmModal';

export interface ConfirmRequestOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmModalVariant;
}

interface ConfirmState extends ConfirmRequestOptions {
  isOpen: boolean;
  resolver: ((accepted: boolean) => void) | null;
}

const initialState: ConfirmState = {
  isOpen: false,
  title: '',
  message: '',
  confirmText: undefined,
  cancelText: undefined,
  variant: 'warning',
  resolver: null,
};

export function useConfirmModal() {
  const [state, setState] = useState<ConfirmState>(initialState);

  const requestConfirm = useCallback((options: ConfirmRequestOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        variant: options.variant ?? 'warning',
        resolver: resolve,
      });
    });
  }, []);

  const closeWithResult = useCallback((accepted: boolean) => {
    setState((previous) => {
      previous.resolver?.(accepted);
      return {
        ...initialState,
      };
    });
  }, []);

  const ConfirmModalRenderer = useCallback(() => {
    return (
      <ConfirmModal
        isOpen={state.isOpen}
        title={state.title}
        message={state.message}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        variant={state.variant}
        onConfirm={() => closeWithResult(true)}
        onCancel={() => closeWithResult(false)}
      />
    );
  }, [state, closeWithResult]);

  return {
    requestConfirm,
    ConfirmModalRenderer,
  };
}

export default useConfirmModal;
