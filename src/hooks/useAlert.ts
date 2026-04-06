import { useState, useCallback } from 'react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface AlertState {
  show: boolean;
  type: AlertType;
  title: string;
  message: string;
}

const initialAlertState: AlertState = {
  show: false,
  type: 'info',
  title: '',
  message: '',
};

export function useAlert() {
  const [alertState, setAlertState] = useState<AlertState>(initialAlertState);

  const showAlert = useCallback(
    (type: AlertType, title: string, message: string) => {
      setAlertState({
        show: true,
        type,
        title,
        message,
      });
    },
    []
  );

  const showSuccess = useCallback(
    (title: string, message: string = '') => {
      showAlert('success', title, message);
    },
    [showAlert]
  );

  const showError = useCallback(
    (title: string, message: string = '') => {
      showAlert('error', title, message);
    },
    [showAlert]
  );

  const showWarning = useCallback(
    (title: string, message: string = '') => {
      showAlert('warning', title, message);
    },
    [showAlert]
  );

  const showInfo = useCallback(
    (title: string, message: string = '') => {
      showAlert('info', title, message);
    },
    [showAlert]
  );

  const hideAlert = useCallback(() => {
    setAlertState(initialAlertState);
  }, []);

  return {
    alertState,
    showAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideAlert,
  };
}














