import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ScrollPickerProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit?: string;
}

const ScrollPicker: React.FC<ScrollPickerProps> = ({ value, onChange, min, max, unit = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const itemHeight = 50;
  const itemsAboveCenter = 2;

  const items = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const scrollToValue = useCallback((val: number) => {
    if (containerRef.current) {
      const index = val - min;
      const scrollTop = index * itemHeight;
      containerRef.current.scrollTop = scrollTop;
    }
  }, [min]);

  useEffect(() => {
    scrollToValue(value);
  }, [scrollToValue, value]);

  const handleScroll = () => {
    if (containerRef.current && !isDragging) {
      const scrollTop = containerRef.current.scrollTop;
      const index = Math.round(scrollTop / itemHeight);
      const newValue = Math.max(min, Math.min(max, min + index));
      if (newValue !== value) {
        onChange(newValue);
      }
    }
  };

  const handleScrollEnd = () => {
    if (containerRef.current) {
      const scrollTop = containerRef.current.scrollTop;
      const index = Math.round(scrollTop / itemHeight);
      const newValue = Math.max(min, Math.min(max, min + index));
      onChange(newValue);
      scrollToValue(newValue);
      setIsDragging(false);
    }
  };

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  const handleTouchEnd = () => {
    handleScrollEnd();
  };

  const getItemStyle = (item: number): React.CSSProperties => {
    const index = item - min;
    const currentIndex = value - min;
    const distance = Math.abs(index - currentIndex);

    let opacity = 1;
    let scale = 1;
    let color = '#1f2937';
    let fontWeight = 'bold';
    let translateY = 0;

    if (distance === 0) {
      opacity = 1;
      scale = 0.6;
      color = '#1f2937';
      fontWeight = 'bold';
      translateY = 0;
    } else if (distance === 1) {
      opacity = 0.7;
      scale = 0.45;
      color = '#6b7280';
      fontWeight = '600';
      translateY = (index > currentIndex ? -8 : 8);
    } else if (distance === 2) {
      opacity = 0.5;
      scale = 0.35;
      color = '#9ca3af';
      fontWeight = 'normal';
      translateY = (index > currentIndex ? -14 : 14);
    } else {
      opacity = 0.3;
      scale = 0.3;
      color = '#d1d5db';
      fontWeight = 'normal';
      translateY = (index > currentIndex ? -18 : 18);
    }

    return {
      opacity,
      transform: `scale(${scale}) translateY(${translateY}px)`,
      color,
      fontWeight,
      transition: 'all 0.2s ease-out',
    };
  };

  return (
    <div className="relative w-full h-60 flex items-center justify-center">
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll scrollbar-hide snap-y snap-mandatory"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        style={{
          paddingTop: `${itemHeight * itemsAboveCenter}px`,
          paddingBottom: `${itemHeight * itemsAboveCenter}px`,
        }}
      >
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center justify-center snap-start"
            style={{
              height: `${itemHeight}px`,
              ...getItemStyle(item),
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-6xl">{item}</span>
              {unit && item === value && (
                <span className="text-3xl font-medium text-gray-600">{unit}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScrollPicker;
