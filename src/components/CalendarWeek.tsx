import React, { useState, useMemo } from 'react';

interface DateInfo {
  date: Date;
  day: number;
  month: number;
  year: number;
  isFirstDayOfMonth: boolean;
  monthLabel?: string;
}

const CalendarWeek: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(() => today);

  const calendarDates = useMemo(() => {
    const dates: DateInfo[] = [];
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthsToShow = 3;

    for (let monthOffset = 0; monthOffset < monthsToShow; monthOffset++) {
      const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth() + monthOffset, 1);
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isFirstDayOfMonth = day === 1;
        let monthLabel;

        if (isFirstDayOfMonth) {
          monthLabel = `${year}年${month + 1}月`;
        }

        dates.push({
          date,
          day,
          month: month + 1,
          year,
          isFirstDayOfMonth,
          monthLabel
        });
      }
    }

    return dates;
  }, [today]);

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  const renderCalendarGrid = () => {
    const elements: JSX.Element[] = [];
    let currentRow: JSX.Element[] = [];
    let cellCount = 0;

    calendarDates.forEach((dateInfo) => {
      if (dateInfo.isFirstDayOfMonth) {
        if (currentRow.length > 0) {
          while (currentRow.length < 7) {
            currentRow.push(
              <div key={`empty-${cellCount++}`} className="aspect-square"></div>
            );
          }
          elements.push(
            <div key={`row-${elements.length}`} className="grid grid-cols-7 gap-2">
              {currentRow}
            </div>
          );
          currentRow = [];
        }

        elements.push(
          <div key={`label-${dateInfo.year}-${dateInfo.month}`} className="text-sm font-medium text-gray-700 mb-2 mt-3 px-1">
            {dateInfo.monthLabel}
          </div>
        );
      }

      currentRow.push(
        <button
          key={`${dateInfo.year}-${dateInfo.month}-${dateInfo.day}`}
          onClick={() => setSelectedDate(dateInfo.date)}
          className={`
            aspect-square rounded-lg flex items-center justify-center text-lg font-medium transition-all border border-white/30
            ${isSameDay(selectedDate, dateInfo.date)
              ? 'bg-white text-gray-800 shadow-sm'
              : 'bg-transparent text-gray-600 hover:bg-white/50'
            }
          `}
        >
          {dateInfo.day}
        </button>
      );

      if (currentRow.length === 7) {
        elements.push(
          <div key={`row-${elements.length}`} className="grid grid-cols-7 gap-2 mb-1">
            {currentRow}
          </div>
        );
        currentRow = [];
      }
    });

    if (currentRow.length > 0) {
      while (currentRow.length < 7) {
        currentRow.push(
          <div key={`empty-${cellCount++}`} className="aspect-square"></div>
        );
      }
      elements.push(
        <div key={`row-${elements.length}`} className="grid grid-cols-7 gap-2">
          {currentRow}
        </div>
      );
    }

    return elements;
  };

  return (
    <div className="bg-white/40 rounded-2xl p-4 mb-6">
      {renderCalendarGrid()}
    </div>
  );
};

export default CalendarWeek;