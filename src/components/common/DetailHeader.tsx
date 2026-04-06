import React from 'react'
import { ChevronLeft, Plus } from 'lucide-react'

type Action = {
  label?: string
  icon?: React.ReactNode
  onClick?: () => void
}

type DetailHeaderProps = {
  title?: React.ReactNode
  leftAction?: Action
  rightAction?: Action
  dateLabel?: React.ReactNode
  onDateClick?: () => void
  sticky?: boolean
}

export function DetailHeader({ title, leftAction, rightAction, sticky = true }: Omit<DetailHeaderProps, 'dateLabel' | 'onDateClick'>) {
  const handleLeftClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // 阻止事件冒泡到DragPanel
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
    // 立即调用回调，不要延迟
    if (leftAction?.onClick) {
      leftAction.onClick();
    }
  };

  const handleRightClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // 阻止事件冒泡到DragPanel
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
    if (rightAction?.onClick) {
      rightAction.onClick();
    }
  };

  /** 置于 DragPanel 内：不重复 safe-area（index.css `.app-header-shell-inset`），工具行与主壳同高 */
  return (
    <div 
      className={`${sticky ? 'sticky top-0' : ''} z-10 bg-transparent app-header-shell-inset select-none`} 
      style={{ userSelect: 'none' }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="app-header-toolbar select-none" style={{ userSelect: 'none' }}>
        {leftAction && (
          <button
            type="button"
            className="p-0.5 rounded-lg hover:bg-gray-100/80 flex items-center gap-2 text-sm text-gray-700 select-none relative z-20 shrink-0"
            onClick={handleLeftClick}
            onTouchEnd={handleLeftClick}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
            }}
            aria-label={leftAction?.label ?? '返回'}
            style={{ 
              touchAction: 'manipulation', 
              pointerEvents: 'auto',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            {leftAction?.icon ?? <ChevronLeft className="w-6 h-6" />}
          </button>
        )}
        <div className="flex-1 min-w-0 text-base font-normal text-gray-800 text-center select-none px-1" style={{ userSelect: 'none' }}>
          {title}
        </div>
        {rightAction && (
          <button
            type="button"
            className="p-0.5 rounded-lg hover:bg-gray-100/80 flex items-center gap-2 text-sm text-gray-700 select-none shrink-0"
            onClick={handleRightClick}
            onTouchEnd={handleRightClick}
            aria-label={rightAction?.label ?? '+'}
            style={{ touchAction: 'manipulation' }}
          >
            {rightAction?.icon ?? <Plus className="w-6 h-6" />}
          </button>
        )}
      </div>
    </div>
  )
}
