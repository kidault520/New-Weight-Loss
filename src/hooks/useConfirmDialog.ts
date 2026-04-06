import { useState, useCallback } from 'react';

export interface ConfirmDialogOptions {
  title: string;
  message?: string | React.ReactNode;
  cancelText?: string;
  confirmText?: string;
  confirmColor?: 'red' | 'blue' | 'green' | 'gray';
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<ConfirmDialogOptions | null>(null);

  const showConfirm = useCallback((options: ConfirmDialogOptions) => {
    setDialogState(options);
  }, []);

  const hideConfirm = useCallback(() => {
    setDialogState(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (dialogState?.onConfirm) {
      await dialogState.onConfirm();
    }
    hideConfirm();
  }, [dialogState, hideConfirm]);

  const handleCancel = useCallback(() => {
    if (dialogState?.onCancel) {
      dialogState.onCancel();
    }
    hideConfirm();
  }, [dialogState, hideConfirm]);

  return {
    showConfirm,
    hideConfirm,
    dialogState,
    handleConfirm,
    handleCancel,
    isOpen: dialogState !== null
  };
}














