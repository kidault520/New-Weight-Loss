import React from 'react';
import { ModalOverlay } from './ModalOverlay';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertDialogProps {
  show: boolean;
  type?: AlertType;
  title: string;
  message: string | React.ReactNode;
  onClose: () => void;
  confirmText?: string;
  zIndex?: number;
}

export function AlertDialog({
  show,
  type = 'info',
  title,
  message,
  onClose,
  confirmText = '确定',
  zIndex = 80
}: AlertDialogProps) {
  if (!show) return null;

  const typeConfig = {
    success: {
      icon: '✓',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      titleColor: 'text-green-900',
      buttonBg: 'bg-green-500 hover:bg-green-600'
    },
    error: {
      icon: '✕',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      buttonBg: 'bg-red-500 hover:bg-red-600'
    },
    warning: {
      icon: '⚠',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-900',
      buttonBg: 'bg-yellow-500 hover:bg-yellow-600'
    },
    info: {
      icon: 'ℹ',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-900',
      buttonBg: 'bg-blue-500 hover:bg-blue-600'
    }
  };

  const config = typeConfig[type];
  const overlayZIndex = zIndex - 1;
  const isMessageString = typeof message === 'string';

  return (
    <>
      <ModalOverlay onClickClose={onClose} zIndex={overlayZIndex} />
      <div
        className="fixed inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex }}
        onClick={onClose}
      >
        <div className="w-full max-w-sm mx-auto px-4 pointer-events-auto max-h-[80vh]" onClick={e => e.stopPropagation()}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden max-h-[80vh] flex flex-col"
          >
          <div className="p-6 overflow-y-auto">
            <div className="flex items-start space-x-4">
              <div className={`${config.iconBg} rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0`}>
                <span className={`${config.iconColor} text-xl font-bold`}>{config.icon}</span>
              </div>
              <div className="flex-1">
                <div className={`text-lg font-semibold ${config.titleColor} mb-2`}>{title}</div>
                {message && (
                  isMessageString ? (
                    <p className="text-gray-600 text-sm whitespace-pre-line">{message}</p>
                  ) : (
                    <div className="text-gray-600 text-sm">{message}</div>
                  )
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200">
            <button
              onClick={onClose}
              className={`w-full py-3.5 text-sm font-medium text-white ${config.buttonBg} transition-colors`}
            >
              {confirmText}
            </button>
          </div>
        </div>
        </div>
      </div>
    </>
  );
}














