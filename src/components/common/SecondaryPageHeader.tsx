import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface SecondaryPageHeaderProps {
  /** 与 centerSlot 二选一：普通标题文案 */
  title?: string;
  subtitle?: string;
  /** 替代中间标题区（如顶栏 Tab） */
  centerSlot?: React.ReactNode;
  onClose: () => void;
  rightAction?: React.ReactNode;
  className?: string;
}

export function SecondaryPageHeader({ 
  title,
  subtitle,
  centerSlot,
  onClose, 
  rightAction,
  className = '',
}: SecondaryPageHeaderProps) {
  return (
    <div className={`flex-shrink-0 bg-white border-b border-gray-200 ${className}`}>
      <div className="app-header-shell-fullscreen px-2 sm:px-4">
        <div className="app-header-toolbar gap-1">
          <button 
            type="button"
            onClick={onClose} 
            className="p-0.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            aria-label="返回"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex-1 min-w-0 flex justify-center items-center">
            {centerSlot ? (
              centerSlot
            ) : (
              <div className="text-center">
                <h1 className="text-base font-normal text-gray-800">{title}</h1>
                {subtitle && (
                  <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                )}
              </div>
            )}
          </div>
          <div className="w-10 flex-shrink-0 flex justify-end items-center">
            {rightAction}
          </div>
        </div>
      </div>
    </div>
  );
}
















