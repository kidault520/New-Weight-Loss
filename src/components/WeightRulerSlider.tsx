import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';

interface WeightRulerSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hideDisplay?: boolean;
}

const WeightRulerSlider: React.FC<WeightRulerSliderProps> = ({
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit = 'kg',
  hideDisplay = false
}) => {
  void step;
  const rulerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [valueInKg, setValueInKg] = useState(value);
  const [inputValueString, setInputValueString] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const lastUpdateValueRef = useRef<number>(value); // 🔥 修复：使用 ref 跟踪最后更新的值，避免闭包问题
  const isDraggingRef = useRef(false);

  // Constants for ruler layout
  const SCALE_SPACING = 10; // Spacing between scale marks (10px per 0.1kg)
  const CONTAINER_WIDTH = 300; // Width of the visible ruler container (reduced to prevent overflow)
  const CENTER_OFFSET = CONTAINER_WIDTH / 2;
  const STEP = 0.1; // 固定步长为0.1kg

  /** 刻度区域实际宽度常小于 CONTAINER_WIDTH（弹窗窄、maxWidth:100%），必须用 clientWidth/2 作为视口中心，否则会稳定偏一格（约 0.1kg） */
  const getViewportHalf = useCallback((): number => {
    const w = rulerRef.current?.clientWidth;
    if (w != null && w > 0) return w / 2;
    return CONTAINER_WIDTH / 2;
  }, []);

  // 将值舍入到0.1kg精度
  const roundToStep = useCallback((value: number): number => {
    return Math.round(value / STEP) * STEP;
  }, [STEP]);

  // Calculate display value
  const displayValue = valueInKg;

  // Update input value string when display value changes (but not when input is focused)
  useEffect(() => {
    if (!isInputFocused) {
      setInputValueString(displayValue.toFixed(1));
    }
  }, [displayValue, isInputFocused]);

  // 将千克值转换为滚动位置：content 坐标下「视口中心」对准第 stepIndex 格中心
  const kgValueToScrollPosition = useCallback(
    (kgValue: number): number => {
      const clampedVal = Math.max(min, Math.min(max, kgValue));
      const stepIndex = Math.round((clampedVal - min) * (1 / STEP) + Number.EPSILON);
      const tickCenterX = CENTER_OFFSET + stepIndex * SCALE_SPACING + SCALE_SPACING / 2;
      const half = getViewportHalf();
      return tickCenterX - half;
    },
    [min, max, STEP, SCALE_SPACING, CENTER_OFFSET, getViewportHalf]
  );

  const scrollPositionToKgValue = useCallback(
    (scrollLeft: number): number => {
      const half = getViewportHalf();
      const centerX = scrollLeft + half;
      const raw =
        (centerX - CENTER_OFFSET - SCALE_SPACING / 2) / SCALE_SPACING;
      const stepIndex = Math.round(raw + Number.EPSILON);
      const kgValue = min + stepIndex * STEP;
      return Math.max(min, Math.min(max, kgValue));
    },
    [min, max, STEP, SCALE_SPACING, CENTER_OFFSET, getViewportHalf]
  );

  // Update internal value when prop changes
  useEffect(() => {
    const roundedValue = roundToStep(value);
    setValueInKg(roundedValue);
    lastUpdateValueRef.current = roundedValue; // 🔥 修复：同步更新 ref
  }, [value, roundToStep]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  // 布局后同步滚动；实际宽度 ≠ 300 时必须用 clientWidth 重算（见 getViewportHalf）
  useLayoutEffect(() => {
    const el = rulerRef.current;
    if (!el) return;

    const applyScroll = () => {
      if (!rulerRef.current || isDraggingRef.current) return;
      rulerRef.current.scrollLeft = kgValueToScrollPosition(valueInKg);
    };

    applyScroll();

    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => applyScroll())
        : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [valueInKg, kgValueToScrollPosition]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (rulerRef.current && !isDragging) {
      const scrollLeft = rulerRef.current.scrollLeft;
      const newKgValue = scrollPositionToKgValue(scrollLeft);
      const roundedValue = roundToStep(newKgValue);

      // 🔥 修复：在滚动时也实时调用 onChange，让父组件能够实时更新 BMI
      // 只有当值变化足够大时才更新
      if (Math.abs(roundedValue - valueInKg) >= STEP * 0.5) {
        setValueInKg(roundedValue);
        onChange(roundedValue);
        lastUpdateValueRef.current = roundedValue;
      }
    }
  }, [scrollPositionToKgValue, valueInKg, STEP, roundToStep, isDragging, onChange]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValueString(e.target.value);
  }, []);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true);
  }, []);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false);
    const inputValue = parseFloat(inputValueString);
    if (!isNaN(inputValue) && inputValue > 0) {
      const roundedKgValue = roundToStep(inputValue);
      setValueInKg(roundedKgValue);
      onChange(roundedKgValue);
      lastUpdateValueRef.current = roundedKgValue; // 🔥 修复：同步更新 ref
    } else {
      // 如果输入无效，恢复为当前显示值
      setInputValueString(displayValue.toFixed(1));
    }
  }, [inputValueString, onChange, displayValue, roundToStep]);

  // Handle input key down
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  }, []);
  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    
    const startX = e.clientX;
    const startScrollLeft = rulerRef.current?.scrollLeft || 0;
    // 🔥 修复：使用 ref 获取当前值，避免闭包问题
    lastUpdateValueRef.current = valueInKg;

    const handleMouseMove = (e: MouseEvent) => {
      if (rulerRef.current) {
        const deltaX = startX - e.clientX;
        const newScrollLeft = startScrollLeft + deltaX;
        rulerRef.current.scrollLeft = newScrollLeft;

        const newKgValue = scrollPositionToKgValue(newScrollLeft);
        const roundedValue = roundToStep(newKgValue);
        setValueInKg(roundedValue);
        
        // 🔥 修复：在滑动过程中实时调用 onChange，让父组件能够实时更新 BMI
        // 使用节流：只在值有明显变化时调用（至少变化 0.05kg，即半个步长）
        if (Math.abs(roundedValue - lastUpdateValueRef.current) >= STEP * 0.5) {
          onChange(roundedValue);
          lastUpdateValueRef.current = roundedValue;
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      if (rulerRef.current) {
        const scrollLeft = rulerRef.current.scrollLeft;
        const finalKgValue = scrollPositionToKgValue(scrollLeft);
        const roundedValue = roundToStep(finalKgValue);

        setValueInKg(roundedValue);
        // 确保最终值被更新（即使变化很小也要更新）
        if (Math.abs(roundedValue - lastUpdateValueRef.current) >= STEP * 0.1) {
          onChange(roundedValue);
          lastUpdateValueRef.current = roundedValue;
        }
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [scrollPositionToKgValue, onChange, roundToStep, valueInKg, STEP]);

  // Handle touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    
    const startX = e.touches[0].clientX;
    const startScrollLeft = rulerRef.current?.scrollLeft || 0;
    // 🔥 修复：使用 ref 获取当前值，避免闭包问题
    lastUpdateValueRef.current = valueInKg;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (rulerRef.current && e.touches.length > 0) {
        const deltaX = startX - e.touches[0].clientX;
        const newScrollLeft = startScrollLeft + deltaX;
        rulerRef.current.scrollLeft = newScrollLeft;

        const newKgValue = scrollPositionToKgValue(newScrollLeft);
        const roundedValue = roundToStep(newKgValue);
        setValueInKg(roundedValue);
        
        // 🔥 修复：在滑动过程中实时调用 onChange，让父组件能够实时更新 BMI
        // 使用节流：只在值有明显变化时调用（至少变化 0.05kg，即半个步长）
        if (Math.abs(roundedValue - lastUpdateValueRef.current) >= STEP * 0.5) {
          onChange(roundedValue);
          lastUpdateValueRef.current = roundedValue;
        }
      }
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      if (rulerRef.current) {
        const scrollLeft = rulerRef.current.scrollLeft;
        const finalKgValue = scrollPositionToKgValue(scrollLeft);
        const roundedValue = roundToStep(finalKgValue);

        setValueInKg(roundedValue);
        // 确保最终值被更新（即使变化很小也要更新）
        if (Math.abs(roundedValue - lastUpdateValueRef.current) >= STEP * 0.1) {
          onChange(roundedValue);
          lastUpdateValueRef.current = roundedValue;
        }
      }

      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [scrollPositionToKgValue, onChange, roundToStep, valueInKg, STEP]);

  // Generate ruler scales
  const generateScales = () => {
    const scales = [];
    const totalSteps = Math.round((max - min) / STEP);

    for (let i = 0; i <= totalSteps; i++) {
      const currentValue = min + i * STEP;

      // 统一的标签显示逻辑：每整数显示主标签，每0.5显示中等刻度
      const isMainScale = Math.abs(currentValue % 1) < 0.001;
      const isHalfScale = Math.abs((currentValue * 2) % 1) < 0.001 && !isMainScale;
      
      scales.push(
        <div
          key={i}
          className="relative flex-shrink-0"
          style={{ width: SCALE_SPACING, height: '48px' }}
        >
          <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 flex flex-col items-center">
            {isMainScale && (
              <span className="text-xs text-gray-500 mb-1 leading-none">
                {currentValue.toFixed(0)}
              </span>
            )}
            <div
              className={`bg-gray-400 ${
                isMainScale
                  ? 'h-8 w-0.5'
                  : isHalfScale
                  ? 'h-5 w-0.5'
                  : 'h-3 w-px'
              }`}
            />
          </div>
        </div>
      );
    }
    
    return scales;
  };

  return (
    <div className="w-full">
      {/* Display current value */}
      {!hideDisplay && (
        <div className="text-center mb-4">
          <div className="flex items-baseline justify-center gap-1">
            <input
              type="number"
              value={inputValueString}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="text-4xl font-bold text-gray-800 text-center bg-transparent border-none focus:outline-none w-32"
            />
            <span className="text-lg text-gray-800">{unit}</span>
          </div>
        </div>
      )}

      {/* 指针必须与刻度视口同宽、同坐标系：外层全宽时 left-1/2 对准的是屏幕中心，与 300px 刻度区域中心可能差几像素，表现为整格 0.1kg 偏差 */}
      <div
        className="relative mx-auto"
        style={{ width: CONTAINER_WIDTH, maxWidth: '100%' }}
      >
        {/* Center indicator：严格对齐本容器水平中心 = 刻度 scroll 视口中心 */}
        <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2 pointer-events-none">
          <div className="flex flex-col items-center">
            <div className="w-1 h-4 bg-green-500" />
            <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-transparent border-t-green-500" />
          </div>
        </div>

        <div
          ref={rulerRef}
          className="flex items-end overflow-x-scroll scrollbar-hide cursor-grab active:cursor-grabbing select-none"
          style={{
            width: CONTAINER_WIDTH,
            maxWidth: '100%',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div style={{ width: CENTER_OFFSET, flexShrink: 0 }} />

          {generateScales()}

          <div style={{ width: CENTER_OFFSET, flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
};

export default WeightRulerSlider;