import React, { useRef, useEffect } from 'react';
import { getDaySuffix } from '../../utils/dateUtils';

interface DateScrollSelectorProps {
  dates: Date[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  showDaySuffix?: boolean; // 是否显示第X天后缀
  formatDate?: (date: Date) => string;
  className?: string;
  /**
   * sticky：在可滚动父级内吸顶（默认）。
   * static：由外层固定在滚动区上方时使用（避免 Drawer transform 导致 sticky 失效）。
   */
  pinMode?: 'sticky' | 'static';
}

export const DateScrollSelector: React.FC<DateScrollSelectorProps> = ({
  dates,
  selectedDate,
  onDateChange,
  showDaySuffix = false,
  formatDate,
  className = '',
  pinMode = 'sticky',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到选中日期
  useEffect(() => {
    if (scrollRef.current) {
      const selectedIndex = dates.findIndex(date =>
        date.toDateString() === selectedDate.toDateString()
      );

      if (selectedIndex !== -1) {
        // 计算滚动位置以居中显示选中的日期
        const buttonWidth = 56; // w-12 (48px) + space-x-2 (8px) = 56px
        const containerWidth = scrollRef.current.clientWidth;
        const scrollPosition = (selectedIndex * buttonWidth) - (containerWidth / 2) + (buttonWidth / 2);

        scrollRef.current.scrollTo({
          left: Math.max(0, scrollPosition),
          behavior: 'auto',
        });
      }
    }
  }, [selectedDate, dates]);

  const displayFormatDate = formatDate || ((date: Date) => date.getDate().toString());

  const pinClass =
    pinMode === 'static'
      ? 'relative shrink-0 bg-white shadow-sm border-b border-gray-100/90'
      : 'sticky top-0 z-20 bg-white shadow-sm border-b border-gray-100/90';

  return (
    <div className={`${pinClass} ${className}`}>
      <div className="px-4 py-2.5">
        <div className="bg-gray-100 rounded-2xl p-1">
          <div ref={scrollRef} className="flex overflow-x-auto space-x-2 scrollbar-hide">
            {dates.map((dateObj, index) => {
              const mealPlanDay = index + 1;
              const isSelected = selectedDate.toDateString() === dateObj.toDateString();
              
              return (
                <div
                  key={dateObj.getTime()}
                  data-meal-plan-date-cell
                  role="button"
                  aria-label={`${mealPlanDay}日`}
                  aria-pressed={isSelected}
                  onClick={() => onDateChange(dateObj)}
                  className={`
                    w-12 aspect-square rounded-xl flex items-center justify-center text-base font-medium transition-all relative flex-shrink-0 touch-manipulation cursor-pointer select-none
                    ${isSelected
                      ? 'bg-purple-500 text-white shadow-sm' 
                      : 'bg-transparent text-gray-500'
                    }
                  `}
                >
                  {displayFormatDate(dateObj)}
                  {showDaySuffix && (
                    <div className={`absolute top-0.5 right-0.5 text-xs font-medium ${
                      isSelected ? 'text-purple-400' : 'text-gray-400'
                    }`}>
                      {mealPlanDay}{getDaySuffix(mealPlanDay)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

