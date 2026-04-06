import React from 'react';
import { X } from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';

interface BottomSheetModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  zIndex?: number;
  maxHeight?: string;
  headerClassName?: string;
  contentClassName?: string;
  showCloseButton?: boolean;
}

export function BottomSheetModal({
  show,
  onClose,
  title,
  children,
  zIndex = 95,
  maxHeight = '90vh',
  headerClassName = '',
  contentClassName = '',
  showCloseButton = true,
}: BottomSheetModalProps) {
  if (!show) return null;

  const modalZIndex = zIndex + 5; // 确保模态框在遮罩层之上

  return (
    <ModalOverlay onClickClose={onClose} zIndex={zIndex}>
      <div
        className="fixed inset-0 flex items-end justify-center"
        style={{ zIndex: modalZIndex }}
        onClick={onClose}
      >
        <div
          className={`bg-white rounded-t-3xl p-6 overflow-y-auto max-w-sm w-full ${contentClassName}`}
          style={{ maxHeight }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between mb-6 ${headerClassName}`}>
            <h2 className="text-lg font-medium text-gray-800">{title}</h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>

          {/* Content */}
          {children}
        </div>
      </div>
    </ModalOverlay>
  );
}














