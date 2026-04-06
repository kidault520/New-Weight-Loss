import React from 'react';
import { X } from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';

interface CenterModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  zIndex?: number;
  maxWidth?: string;
  headerClassName?: string;
  contentClassName?: string;
  showCloseButton?: boolean;
  showHeaderBorder?: boolean;
}

export function CenterModal({
  show,
  onClose,
  title,
  children,
  zIndex = 80,
  maxWidth = 'max-w-sm',
  headerClassName = '',
  contentClassName = '',
  showCloseButton = true,
  showHeaderBorder = true,
}: CenterModalProps) {
  if (!show) return null;

  const modalZIndex = zIndex + 5; // 确保模态框在遮罩层之上
  const overlayZIndex = zIndex - 1;

  return (
    <>
      <ModalOverlay onClickClose={onClose} zIndex={overlayZIndex} />
      <div
        className="fixed inset-0 flex items-center justify-center px-6"
        style={{ zIndex: modalZIndex }}
        onClick={onClose}
      >
        <div
          className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden ${contentClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`px-6 py-4 flex items-center justify-between ${
              showHeaderBorder ? 'border-b border-gray-200' : ''
            } ${headerClassName}`}
          >
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>

          {/* Content */}
          {children}
        </div>
      </div>
    </>
  );
}














