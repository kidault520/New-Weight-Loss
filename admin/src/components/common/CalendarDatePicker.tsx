/**
 * 日历式日期选择器
 * 年/月可点击快速选择
 */

import { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface CalendarDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

type ViewMode = 'day' | 'month' | 'year';

export default function CalendarDatePicker({
  value,
  onChange,
  placeholder = '请选择日期',
  disabled = false,
  className = '',
}: CalendarDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      return new Date(y, (m || 1) - 1, 1);
    }
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setViewMode('day');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayValue = value ? value.replace(/-/g, '/') : '';
  const selectedDate = value ? new Date(value + 'T12:00:00') : null;

  const getDaysInMonth = (d: Date) => {
    const year = d.getFullYear();
    const month = d.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7;
    const daysInMonth = lastDay.getDate();
    const prevMonth = new Date(year, month, 0).getDate();
    const days: { date: Date; isCurrent: boolean; isSelected: boolean }[] = [];

    for (let i = 0; i < startPad; i++) {
      days.push({
        date: new Date(year, month - 1, prevMonth - startPad + i + 1),
        isCurrent: false,
        isSelected: false,
      });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({
        date: d,
        isCurrent: true,
        isSelected: selectedDate
          ? d.getFullYear() === selectedDate.getFullYear() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getDate() === selectedDate.getDate()
          : false,
      });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrent: false,
        isSelected: false,
      });
    }
    return days;
  };

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handleSelectDay = (d: Date) => {
    onChange(formatDate(d));
    setIsOpen(false);
    setViewMode('day');
  };

  const handleSelectMonth = (month: number) => {
    setViewDate(new Date(viewDate.getFullYear(), month, 1));
    setViewMode('day');
  };

  const handleSelectYear = (year: number) => {
    setViewDate(new Date(year, viewDate.getMonth(), 1));
    setViewMode('month');
  };

  const setToday = () => {
    const today = new Date();
    onChange(formatDate(today));
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setIsOpen(false);
    setViewMode('day');
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const decadeStart = Math.floor(year / 10) * 10;
  const years = Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i);

  const days = getDaysInMonth(viewDate);

  const renderHeader = () => (
    <div className="flex items-center justify-between mb-3 gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (viewMode === 'year') setViewDate(new Date(decadeStart - 10, month, 1));
          else setViewDate(new Date(year - 1, month, 1));
        }}
        className="p-1 hover:bg-slate-100 rounded shrink-0"
      >
        «
      </button>
      {viewMode === 'day' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setViewDate(new Date(year, month - 1, 1));
          }}
          className="p-1 hover:bg-slate-100 rounded shrink-0"
        >
          ‹
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (viewMode === 'day') setViewMode('month');
          else if (viewMode === 'month') setViewMode('year');
        }}
        className="flex-1 min-w-0 px-2 py-1 font-medium text-slate-800 hover:bg-slate-100 rounded cursor-pointer text-center"
      >
        {viewMode === 'year' ? `${decadeStart}~${decadeStart + 9}` : viewMode === 'month' ? `${year}` : `${year} ${MONTH_NAMES[month]}`}
      </button>
      {viewMode === 'day' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setViewDate(new Date(year, month + 1, 1));
          }}
          className="p-1 hover:bg-slate-100 rounded shrink-0"
        >
          ›
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (viewMode === 'year') setViewDate(new Date(decadeStart + 10, month, 1));
          else setViewDate(new Date(year + 1, month, 1));
        }}
        className="p-1 hover:bg-slate-100 rounded shrink-0"
      >
        »
      </button>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer ${
          disabled ? 'bg-slate-100 cursor-not-allowed' : 'bg-white border-slate-300 hover:border-indigo-400'
        }`}
      >
        <input
          type="text"
          value={displayValue}
          readOnly
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none cursor-pointer text-slate-700 placeholder:text-slate-400"
        />
        <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4 min-w-[320px]">
          {renderHeader()}

          {viewMode === 'day' && (
            <>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="text-center text-xs text-slate-500 py-1">
                    {w}
                  </div>
                ))}
                {days.map(({ date, isCurrent, isSelected }, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectDay(date)}
                    className={`p-2 text-sm rounded-lg transition-colors ${
                      !isCurrent ? 'text-slate-300' : isSelected ? 'bg-emerald-500 text-white' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={setToday}
                className="w-full py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                今天
              </button>
            </>
          )}

          {viewMode === 'month' && (
            <div className="grid grid-cols-3 gap-2">
              {MONTH_NAMES.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectMonth(i)}
                  className={`p-3 text-sm rounded-lg transition-colors ${
                    selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === i
                      ? 'bg-emerald-500 text-white'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {viewMode === 'year' && (
            <div className="grid grid-cols-3 gap-2">
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => handleSelectYear(y)}
                  className={`p-3 text-sm rounded-lg transition-colors ${
                    (y < decadeStart || y > decadeStart + 9)
                      ? 'text-slate-300'
                      : selectedDate && selectedDate.getFullYear() === y
                      ? 'bg-emerald-500 text-white'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
