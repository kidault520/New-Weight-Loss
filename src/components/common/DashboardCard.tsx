import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface DashboardCardProps {
  title?: string;
  children: React.ReactNode;
  onCardClick?: () => void;
  onPlusClick?: (e: React.MouseEvent) => void;
  showPlus?: boolean;
  className?: string;
  contentClassName?: string;
  // 收缩动画状态（由父组件管理，如果提供则使用外部状态）
  isShrunk?: boolean;
  // 自定义头部内容
  headerContent?: React.ReactNode;
  // 特殊布局（如calories的双栏布局）
  layout?: 'default' | 'split';
  rightContent?: React.ReactNode;
  // 是否禁用点击交互（用于特殊卡片）
  disableClick?: boolean;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  children,
  onCardClick,
  onPlusClick,
  showPlus = false,
  className = '',
  contentClassName = '',
  isShrunk: externalIsShrunk,
  headerContent,
  layout = 'default',
  rightContent,
  disableClick = false,
}) => {
  // 内部管理收缩动画状态（如果外部没有提供）
  const [internalIsPressed, setInternalIsPressed] = useState(false);
  const [internalIsShrunk, setInternalIsShrunk] = useState(false);
  
  // 使用外部状态或内部状态
  const isShrunk = externalIsShrunk !== undefined ? externalIsShrunk : internalIsShrunk;
  const isPressed = internalIsPressed;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disableClick || !onCardClick) return;
    // 检查事件是否来源于Plus按钮，如果是则忽略
    if ((e.target as Element).closest('.plus-button')) {
      return;
    }
    setInternalIsPressed(true);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (disableClick || !onCardClick) return;
    // 检查事件是否来源于Plus按钮，如果是则忽略
    if ((e.target as Element).closest('.plus-button')) {
      setInternalIsPressed(false);
      return;
    }
    if (isPressed) {
      setInternalIsPressed(false);
      if (externalIsShrunk === undefined) {
        // 如果外部没有管理状态，使用内部状态
        setInternalIsShrunk(true);
        setTimeout(() => {
          onCardClick?.();
          setInternalIsShrunk(false);
        }, 100);
      } else {
        // 如果外部管理状态，直接调用回调
        onCardClick?.();
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disableClick || !onCardClick) return;
    // 检查事件是否来源于Plus按钮，如果是则忽略
    if ((e.target as Element).closest('.plus-button')) {
      return;
    }
    setInternalIsPressed(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (disableClick || !onCardClick) return;
    // 检查事件是否来源于Plus按钮，如果是则忽略
    if ((e.target as Element).closest('.plus-button')) {
      setInternalIsPressed(false);
      return;
    }
    if (isPressed) {
      setInternalIsPressed(false);
      if (externalIsShrunk === undefined) {
        // 如果外部没有管理状态，使用内部状态
        setInternalIsShrunk(true);
        setTimeout(() => {
          onCardClick?.();
          setInternalIsShrunk(false);
        }, 100);
      } else {
        // 如果外部管理状态，直接调用回调
        onCardClick?.();
      }
    }
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlusClick?.(e);
  };

  const baseClasses = `rounded-2xl p-5 border border-[#E6EBF2] shadow-sm transition-all duration-300 ${
    isShrunk ? 'scale-95 bg-white' : 'scale-100 bg-white'
  } ${disableClick ? '' : 'cursor-pointer hover:bg-[#F9FBFF]'} ${className}`;

  // 渲染头部
  const renderHeader = () => {
    if (headerContent) {
      return headerContent;
    }
    
    if (!title && !showPlus) {
      return null;
    }

    return (
      <div className="flex justify-between items-center mb-4">
        {title && <div className="text-lg font-medium text-gray-700">{title}</div>}
        {showPlus && (
          <button
            onClick={handlePlusClick}
            className="plus-button p-1 hover:bg-white/50 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>
    );
  };

  // Split布局（用于calories等特殊卡片）
  if (layout === 'split' && rightContent) {
    return (
      <div className={`col-span-3 rounded-2xl p-0 relative overflow-hidden border border-[#E6EBF2] shadow-sm bg-white flex ${className}`}>
        {/* Left side - Card content */}
        <div
          className={`flex-1 p-5 relative ${disableClick ? '' : 'cursor-pointer hover:bg-[#F9FBFF]'} transition-all duration-300 ${
            isShrunk ? 'scale-95 bg-white' : 'scale-100'
          } ${contentClassName}`}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="z-10 relative">
            {renderHeader()}
            {children}
          </div>
        </div>
        
        {/* Right side - Custom content (e.g., image) */}
        <div className="w-2/5 relative">
          {rightContent}
        </div>
      </div>
    );
  }

  // 默认布局
  return (
    <div
      className={baseClasses}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {renderHeader()}
      <div className={contentClassName}>{children}</div>
    </div>
  );
};

export default DashboardCard;
















