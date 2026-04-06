/**
 * useAddressSwipe - 地址滑动删除逻辑Hook
 * 从AddDeliveryAddressPage.tsx中提取的滑动删除逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */

import { useState, useRef } from 'react';

export function useAddressSwipe() {
  const [swipedAddressId, setSwipedAddressId] = useState<string | null>(null);
  const touchStartX = useRef<{ [key: string]: number }>({});
  const touchStartY = useRef<{ [key: string]: number }>({});

  const handleTouchStart = (addressId: string, e: React.TouchEvent) => {
    touchStartX.current[addressId] = e.touches[0].clientX;
    touchStartY.current[addressId] = e.touches[0].clientY;
  };

  const handleTouchMove = (addressId: string, e: React.TouchEvent) => {
    if (!touchStartX.current[addressId]) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = touchStartX.current[addressId] - currentX;
    const diffY = Math.abs(touchStartY.current[addressId] - currentY);

    if (Math.abs(diffX) > diffY) {
      e.preventDefault();
      const cardElement = document.getElementById(`address-card-${addressId}`);
      if (cardElement) {
        // 向左滑动（diffX > 0）：最多滑动80px
        // 向右滑动（diffX < 0）：从当前位置恢复
        if (diffX > 0) {
          // 向左滑动
          const offset = Math.min(diffX, 80);
          cardElement.style.transform = `translateX(-${offset}px)`;
        } else {
          // 向右滑动 - 从-80px恢复到0
          const currentTransform = cardElement.style.transform;
          const match = currentTransform.match(/translateX\((-?\d+)px\)/);
          const currentOffset = match ? parseInt(match[1]) : 0;

          // 只有当前偏移小于0时才允许向右滑
          if (currentOffset < 0) {
            const newOffset = Math.min(0, currentOffset - diffX);
            cardElement.style.transform = `translateX(${newOffset}px)`;
          }
        }
        cardElement.style.transition = 'none';
      }
    }
  };

  const handleTouchEnd = (addressId: string) => {
    if (!touchStartX.current[addressId]) return;

    const cardElement = document.getElementById(`address-card-${addressId}`);
    if (cardElement) {
      const transform = cardElement.style.transform;
      const match = transform.match(/translateX\((-?\d+)px\)/);
      const offset = match ? parseInt(match[1]) : 0;

      // 如果滑动距离大于40px（负数表示向左）
      if (offset < -40) {
        // 锁定到-80px，显示删除按钮
        cardElement.style.transform = 'translateX(-80px)';
        cardElement.style.transition = 'transform 0.3s ease';
        setSwipedAddressId(addressId);
      } else {
        // 恢复到原位
        cardElement.style.transform = 'translateX(0)';
        cardElement.style.transition = 'transform 0.3s ease';
        if (swipedAddressId === addressId) {
          setSwipedAddressId(null);
        }
      }
    }

    delete touchStartX.current[addressId];
    delete touchStartY.current[addressId];
  };

  const resetSwipe = (addressId: string) => {
    const cardElement = document.getElementById(`address-card-${addressId}`);
    if (cardElement) {
      cardElement.style.transform = 'translateX(0)';
      cardElement.style.transition = 'transform 0.3s ease';
    }
    setSwipedAddressId(null);
  };

  return {
    swipedAddressId,
    setSwipedAddressId,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetSwipe,
  };
}

