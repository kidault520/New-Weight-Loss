import { useState, useRef, useCallback, useEffect } from 'react';

interface UseDragToCloseOptions {
  onClose: () => void;
  threshold?: number; // 拖拽超过多少像素后关闭，默认 100
  closeDelay?: number; // 关闭延迟（毫秒），默认 400-500
  enableCloseAnimation?: boolean; // 是否启用关闭动画，默认 true
}

export function useDragToClose({
  onClose,
  threshold = 100,
  closeDelay = 500,
  enableCloseAnimation = true,
}: UseDragToCloseOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 组件挂载时触发动画
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  // Handle drag start
  const handleStart = useCallback((clientY: number) => {
    setIsDragging(true);
    setStartY(clientY);
    if (containerRef.current) {
      containerRef.current.style.transition = 'none';
    }
  }, []);

  // Handle drag move
  const handleMove = useCallback(
    (clientY: number) => {
      if (!isDragging) return;

      const deltaY = clientY - startY;
      const newTranslateY = Math.max(0, deltaY); // Only allow downward movement
      setTranslateY(newTranslateY);
    },
    [isDragging, startY]
  );

  // 处理关闭动画
  const handleClose = useCallback(() => {
    if (enableCloseAnimation) {
      setIsVisible(false);
      // 等待动画完成后再调用 onClose
      setTimeout(() => {
        onClose();
      }, closeDelay);
    } else {
      onClose();
    }
  }, [onClose, closeDelay, enableCloseAnimation]);

  // Handle drag end
  const handleEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.3s ease-out';
    }

    // If dragged down more than threshold, close the screen
    if (translateY > threshold) {
      handleClose();
    } else {
      // Otherwise, snap back to original position
      setTranslateY(0);
    }
  }, [isDragging, translateY, threshold, handleClose]);

  // Mouse events
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleStart(e.clientY);
    },
    [handleStart]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleMove(e.clientY);
    },
    [handleMove]
  );

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Touch events
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleStart(e.touches[0].clientY);
    },
    [handleStart]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientY);
      }
    },
    [handleMove]
  );

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Add/remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return {
    isDragging,
    translateY,
    isVisible,
    containerRef,
    handleMouseDown,
    handleTouchStart,
    handleClose,
  };
}

