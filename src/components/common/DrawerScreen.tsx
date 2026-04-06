import React, { useEffect, useRef, useState, useCallback } from 'react'

type DrawerScreenProps = {
  show: boolean
  onClose: () => void
  children: React.ReactNode
  showMask?: boolean
  maskClickable?: boolean
  showDragHandle?: boolean
}

export function DrawerScreen({ 
  show, 
  onClose, 
  children, 
  showMask = false,
  maskClickable = true,
  showDragHandle = true
}: DrawerScreenProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [translateX, setTranslateX] = useState(0)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Trigger slide-in animation when show becomes true
  useEffect(() => {
    if (show) {
      setTranslateX(0)
      // Use rAF to ensure first paint is off-screen, then animate in
      const timer = requestAnimationFrame(() => {
        setIsVisible(true)
      })
      return () => cancelAnimationFrame(timer)
    } else {
      setIsVisible(false)
      setTranslateX(0) // 🔥 修复：重置位置
    }
  }, [show])

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => {
      onClose()
      setTranslateX(0)
    }, 300)
  }, [onClose])

  // Handle drag start
  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true)
    setStartX(clientX)
    if (drawerRef.current) {
      drawerRef.current.style.transition = 'none'
    }
  }, [])

  // Handle drag move
  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return
    
    const deltaX = clientX - startX
    // Only allow dragging to the right (positive deltaX)
    const newTranslateX = Math.max(0, deltaX)
    setTranslateX(newTranslateX)
  }, [isDragging, startX])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    
    setIsDragging(false)
    
    if (drawerRef.current) {
      drawerRef.current.style.transition = 'transform 0.3s ease-out'
    }
    
    // If dragged more than 100px to the right, close the drawer
    if (translateX > 100) {
      handleClose()
    } else {
      setTranslateX(0)
    }
  }, [isDragging, translateX, handleClose])

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    handleDragStart(e.clientX)
  }, [handleDragStart])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleDragMove(e.clientX)
  }, [handleDragMove])

  const handleMouseUp = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX)
  }, [handleDragStart])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length > 0) {
      handleDragMove(e.touches[0].clientX)
    }
  }, [handleDragMove])

  const handleTouchEnd = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])

  // Add global event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] pointer-events-none">
      {/* Drawer Container - 使用 app 默认容器宽度，居中显示 */}
      <div className="absolute inset-0 flex justify-center pointer-events-none">
        <div className="relative w-full max-w-sm h-full pointer-events-auto overflow-hidden">
          {/* Mask - 限制在 app 默认容器宽度内 */}
          {showMask && (
            <div 
              className={`absolute inset-0 bg-black/30 transition-opacity duration-300 pointer-events-auto ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={maskClickable ? handleClose : undefined}
              style={{ pointerEvents: isVisible ? 'auto' : 'none' }}
            />
          )}
          {/* Drawer - 从容器右侧滑入 */}
          <div
            ref={drawerRef}
            className={`absolute inset-y-0 right-0 w-full bg-white flex flex-col transition-transform duration-300 ease-out shadow-2xl ${
              isVisible ? 'translate-x-0' : 'translate-x-full'
            }`}
            style={isDragging ? {
              transform: `translateX(${translateX}px)`,
              transitionProperty: 'none'
            } : {}}
          >
            {/* Drag Handle */}
            {showDragHandle && (
              <div 
                className="flex justify-center py-2 cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
              >
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
            )}
            
            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

