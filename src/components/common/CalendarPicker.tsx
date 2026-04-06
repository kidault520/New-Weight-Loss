 
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { isPastDate, formatDateLabelFull } from '../../utils/dateUtils';

interface CalendarPickerProps {
  availableDates: Date[]; // 可选的日期列表
  selectedDates: Date[]; // 已选中的日期列表
  onDateClick: (date: Date) => void;
  minDate?: Date; // 最小可选日期
  maxDate?: Date; // 最大可选日期
  multiSelect?: boolean; // 是否多选
  packageDuration?: number; // 选择开始日期后自动选择N天
  showDateRange?: boolean; // 是否显示日期范围
  className?: string;
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  availableDates,
  selectedDates,
  onDateClick,
  minDate,
  showDateRange = true,
  className = ''
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // 生成当前月份的所有日期
  const generateAllAvailableDates = () => {
    const dates: Date[] = [];
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 1; i <= lastDayOfMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      date.setHours(0, 0, 0, 0);
      dates.push(date);
    }
    return dates;
  };

  // 按月份分组日期
  const groupDatesByMonth = (dates: Date[]) => {
    const groups: { month: number; year: number; dates: Date[]; allDates: Date[] }[] = [];

    dates.forEach(date => {
      const month = date.getMonth();
      const year = date.getFullYear();

      let group = groups.find(g => g.month === month && g.year === year);
      if (!group) {
        group = { month, year, dates: [], allDates: [] };
        groups.push(group);
      }
      group.dates.push(date);
    });

    groups.forEach((group) => {
      const firstDayOfMonth = new Date(group.year, group.month, 1);
      const lastDayOfMonth = new Date(group.year, group.month + 1, 0);
      const startDate = new Date(firstDayOfMonth);
      const dayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - dayOfWeek);

      const allDates: Date[] = [];
      const currentDate = new Date(startDate);

      while (currentDate <= lastDayOfMonth || allDates.length % 7 !== 0) {
        allDates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      group.allDates = allDates;
    });

    return groups;
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const isDateInSelected = (date: Date) => {
    return selectedDates.some(d => d.toDateString() === date.toDateString());
  };

  const isDatePastOrToday = (date: Date) => {
    if (minDate) {
      const compareDate = new Date(date);
      compareDate.setHours(0, 0, 0, 0);
      const min = new Date(minDate);
      min.setHours(0, 0, 0, 0);
      return compareDate < min;
    }
    return isPastDate(date);
  };

  const isDateAvailable = (date: Date) => {
    if (availableDates.length === 0) return true;
    return availableDates.some(d => d.toDateString() === date.toDateString());
  };

  // Generate dates for current month if availableDates is empty
  const datesToUse = availableDates.length > 0 ? availableDates : generateAllAvailableDates();
  const dateGroups = groupDatesByMonth(datesToUse);
  const currentGroup = dateGroups.find(g => g.month === currentMonth && g.year === currentYear);
  
  // If no group found, generate a default one for current month
  const defaultGroup = currentGroup || (() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDayOfMonth);
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const allDates: Date[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= lastDayOfMonth || allDates.length % 7 !== 0) {
      allDates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { month: currentMonth, year: currentYear, dates: [], allDates };
  })();

  return (
    <div className={className}>
      <div className="ml-4 mr-4 px-4 py-4 bg-white border border-gray-300 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">选择开始日期</h3>
          <div className="flex items-center">
            <button onClick={handlePrevMonth} className="p-1">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-800 mx-2">
              {currentYear}年{currentMonth + 1}月
            </span>
            <button onClick={handleNextMonth} className="p-1">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0 mb-2">
          {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((day) => (
            <div key={day} className="text-center text-xs text-gray-500 font-medium py-1">
              {day}
            </div>
          ))}
        </div>

        {defaultGroup && (
          <div className="grid grid-cols-7 gap-0 mb-4">
            {defaultGroup.allDates.map((date, index) => {
              const isSelected = isDateInSelected(date);
              const isPastOrToday = isDatePastOrToday(date);
              const isInCurrentMonth = date.getMonth() === defaultGroup.month;
              const isAvailableDate = availableDates.length === 0 || isDateAvailable(date);

              return (
                <button
                  key={index}
                  disabled={isPastOrToday || !isAvailableDate}
                  onClick={() => !isPastOrToday && isAvailableDate && onDateClick(date)}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium relative
                    ${isPastOrToday || !isAvailableDate
                      ? 'text-gray-300 cursor-not-allowed'
                      : isSelected
                        ? 'text-green-600 font-semibold'
                        : isInCurrentMonth
                          ? 'text-gray-800'
                          : 'text-gray-400'
                    }
                  `}
                >
                  {isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-6 h-6 rounded-full bg-green-100"></span>
                    </span>
                  )}
                  <span className="relative z-10">{date.getDate()}</span>
                </button>
              );
            })}
          </div>
        )}

        {showDateRange && selectedDates.length > 0 && (
          <>
            <div className="border-t border-gray-300 my-4"></div>
            <div className="flex items-center justify-start space-x-6 text-sm">
              <div>
                <span className="text-gray-600">开始：</span>
                <span className="text-gray-800 font-bold">
                  {formatDateLabelFull(selectedDates[0])}
                </span>
              </div>
              <div>
                <span className="text-gray-600">结束：</span>
                <span className="text-gray-800 font-bold">
                  {formatDateLabelFull(selectedDates[selectedDates.length - 1])}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

