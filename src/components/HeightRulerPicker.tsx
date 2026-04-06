import React, { useCallback, useEffect, useRef } from 'react';

interface HeightRulerPickerProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const HeightRulerPicker: React.FC<HeightRulerPickerProps> = ({
  value,
  onChange,
  min = 100,
  max = 250
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeight = 8;
  const centerOffset = 171;

  const scrollToValue = useCallback((val: number) => {
    if (containerRef.current) {
      const scrollTop = (max - val) * itemHeight;
      containerRef.current.scrollTop = scrollTop;
    }
  }, [max]);

  useEffect(() => {
    scrollToValue(value);
  }, [scrollToValue, value]);

  const handleScroll = () => {
    if (containerRef.current) {
      const scrollTop = containerRef.current.scrollTop;
      const newValue = Math.round(max - scrollTop / itemHeight);
      const clampedValue = Math.max(min, Math.min(max, newValue));
      if (clampedValue !== value) {
        onChange(clampedValue);
      }
    }
  };

  const handleScrollEnd = () => {
    if (containerRef.current) {
      const scrollTop = containerRef.current.scrollTop;
      const newValue = Math.round(max - scrollTop / itemHeight);
      const clampedValue = Math.max(min, Math.min(max, newValue));
      onChange(clampedValue);
      scrollToValue(clampedValue);
    }
  };

  const handleTouchEnd = () => {
    handleScrollEnd();
  };

  const renderRulerMarks = () => {
    const marks = [];
    for (let i = max; i >= min; i--) {
      const isTen = i % 10 === 0;
      const isFive = i % 5 === 0;

      marks.push(
        <div
          key={i}
          className="flex items-center"
          style={{ height: `${itemHeight}px` }}
        >
          <div className="flex items-center w-full">
            <div
              className={`
                ${isTen ? 'w-12 h-0.5 bg-gray-600' : isFive ? 'w-8 h-0.5 bg-gray-400' : 'w-4 h-px bg-gray-300'}
              `}
            />
            {isTen && (
              <span className="ml-3 text-base text-gray-500 font-medium min-w-[3rem]">
                {i}
              </span>
            )}
          </div>
        </div>
      );
    }
    return marks;
  };

  return (
    <div className="relative w-full h-[500px] flex items-center">
      <div className="absolute left-0 right-0 top-[35%] -translate-y-1/2 z-10 pointer-events-none">
        <div className="h-0.5 bg-emerald-400 shadow-lg" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 bg-white px-4 py-2 rounded-l-xl shadow-lg">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold text-gray-800">{value}</span>
            <span className="text-xl text-gray-600">cm</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll scrollbar-hide"
        onScroll={handleScroll}
        onTouchEnd={handleTouchEnd}
        onMouseUp={handleTouchEnd}
        style={{
          paddingTop: `${centerOffset}px`,
          paddingBottom: `${centerOffset}px`,
        }}
      >
        <div className="pl-4">
          {renderRulerMarks()}
        </div>
      </div>
    </div>
  );
};

export default HeightRulerPicker;
