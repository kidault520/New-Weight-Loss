 
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { UserPackage, MockPackageData, calculatePackageDates } from '../services/packageService';

interface DateMealSelectionPageProps {
  onClose: () => void;
  onNext: (selectedDates: Date[], selectedMealTypes: string[]) => void;
  packageData?: UserPackage | MockPackageData | null;
}

const DateMealSelectionPage: React.FC<DateMealSelectionPageProps> = ({
  onClose,
  onNext,
  packageData
}) => {
  const packageDuration = packageData?.package_duration || 7; // 测试演示用，正常情况下无订单无法配置
  const includedMeals = packageData?.included_meals || ['breakfast', 'lunch', 'dinner'];

  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedMealTypes, setSelectedMealTypes] = useState<string[]>(includedMeals);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [calculatedDates, setCalculatedDates] = useState<{
    dates: Date[];
    currentMonthDays: number;
    nextMonthDays: number;
    nextMonthFullDays: number;
    actualStartDate: Date;
  } | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const packageDatesData = calculatePackageDates(startDate, packageDuration);
    setCalculatedDates(packageDatesData);
  }, [packageDuration]);

  const generateAllAvailableDates = () => {
    if (!calculatedDates) return [];

    const dates: Date[] = [];
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Generate all dates for the current viewing month
    for (let i = 1; i <= lastDayOfMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      date.setHours(0, 0, 0, 0);
      dates.push(date);
    }

    return dates;
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
      // Generate complete month calendar
      const firstDayOfMonth = new Date(group.year, group.month, 1);
      const lastDayOfMonth = new Date(group.year, group.month + 1, 0);

      // Find the Sunday before or on the first day of the month
      const startDate = new Date(firstDayOfMonth);
      const dayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - dayOfWeek);

      const allDates: Date[] = [];
      const currentDate = new Date(startDate);

      // Generate dates until we have complete weeks covering the entire month
      while (currentDate <= lastDayOfMonth || allDates.length % 7 !== 0) {
        allDates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      group.allDates = allDates;
    });

    return groups;
  };

  const isDateInPackage = (date: Date) => {
    return selectedDates.some(d => d.toDateString() === date.toDateString());
  };

  const handleDateClick = (clickedDate: Date) => {
    const newSelectedDates: Date[] = [];
    for (let i = 0; i < packageDuration; i++) {
      const date = new Date(clickedDate);
      date.setDate(clickedDate.getDate() + i);
      newSelectedDates.push(date);
    }
    setSelectedDates(newSelectedDates);
  };

  const isDatePastOrToday = (date: Date) => {
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  };

  const toggleMealType = (mealType: string) => {
    if (includedMeals.includes(mealType)) {
      return;
    }

    if (selectedMealTypes.includes(mealType)) {
      setSelectedMealTypes(selectedMealTypes.filter(type => type !== mealType));
    } else {
      setSelectedMealTypes([...selectedMealTypes, mealType]);
    }
  };

  const isMealLocked = (mealType: string) => {
    return includedMeals.includes(mealType);
  };

  const handleNext = () => {
    if (selectedDates.length > 0 && selectedMealTypes.length > 0) {
      onNext(selectedDates, selectedMealTypes);
    }
  };

  const allDates = generateAllAvailableDates();
  const dateGroups = groupDatesByMonth(allDates);

  return (
    <div className="absolute inset-0 z-[60] bg-white flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-3 py-3 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <button onClick={onClose} className="p-1">
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-base font-medium text-gray-800">选择开始日期</h1>
          <div className="w-8 h-8"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Process Flow Section */}
        <div className="mx-4 my-4 px-4 py-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-500 rounded-2xl">
          {/* Process Steps */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-1">
                <span className="text-gray-800 font-medium text-sm">1</span>
                <span className="text-gray-700 text-xs">选择开始日期</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center space-x-1">
                <span className="text-gray-800 font-medium text-sm">2</span>
                <span className="text-gray-700 text-xs">填写配送地址</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center space-x-1">
                <span className="text-gray-800 font-medium text-sm">3</span>
                <span className="text-gray-700 text-xs">配送计划</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Section */}
        <div className="ml-4 mr-4 px-4 py-4 bg-white border border-gray-300 rounded-lg">
          {/* Title and Month Navigation */}
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

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((day) => (
              <div key={day} className="text-center text-xs text-gray-500 font-medium py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid - Show first month only */}
          {dateGroups.length > 0 && (
            <div className="grid grid-cols-7 gap-2 mb-4">
              {dateGroups[0].allDates.map((date, index) => {
                const isSelected = isDateInPackage(date);
                const isPastOrToday = isDatePastOrToday(date);
                const isInCurrentMonth = date.getMonth() === dateGroups[0].month;
                const isAvailableDate = dateGroups[0].dates.some(d => d.toDateString() === date.toDateString());

                return (
                  <button
                    key={index}
                    disabled={isPastOrToday || !isAvailableDate}
                    onClick={() => !isPastOrToday && isAvailableDate && handleDateClick(date)}
                    className={`
                      aspect-square rounded-full flex items-center justify-center text-sm font-medium relative
                      ${isPastOrToday || !isAvailableDate
                        ? 'text-gray-300 cursor-not-allowed'
                        : isSelected
                          ? 'bg-green-100 text-green-600 font-semibold'
                          : isInCurrentMonth
                            ? 'text-gray-800 hover:bg-gray-100'
                            : 'text-gray-400 hover:bg-gray-50'
                      }
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-300 my-4"></div>

          {/* Start and End Date Display */}
          <div className="flex items-center justify-start space-x-6 text-sm">
            <div>
              <span className="text-gray-600">开始：</span>
              <span className="text-gray-800 font-bold">
                {selectedDates.length > 0 ? `${selectedDates[0].getMonth() + 1}月${selectedDates[0].getDate()}日` : ''}
              </span>
            </div>
            <div>
              <span className="text-gray-600">结束：</span>
              <span className="text-gray-800 font-bold">
                {selectedDates.length > 0 ? `${selectedDates[selectedDates.length - 1].getMonth() + 1}月${selectedDates[selectedDates.length - 1].getDate()}日` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Meal Type Selection */}
        <div className="px-4 py-2">
          <div className="grid grid-cols-3 gap-2">
            {/* Breakfast */}
            <button
              onClick={() => toggleMealType('breakfast')}
              disabled={isMealLocked('breakfast')}
              className={`
                relative py-3 rounded-lg text-sm font-medium transition-all border
                ${selectedMealTypes.includes('breakfast')
                  ? isMealLocked('breakfast')
                    ? 'bg-green-50 border-green-400 text-gray-700 cursor-not-allowed'
                    : 'bg-white border-green-400 text-gray-800'
                  : 'bg-gray-100 border-gray-300 text-gray-500'
                }
              `}
            >
              早餐
              {selectedMealTypes.includes('breakfast') && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>

            {/* Lunch */}
            <button
              onClick={() => toggleMealType('lunch')}
              disabled={isMealLocked('lunch')}
              className={`
                relative py-3 rounded-lg text-sm font-medium transition-all border
                ${selectedMealTypes.includes('lunch')
                  ? isMealLocked('lunch')
                    ? 'bg-green-50 border-green-400 text-gray-700 cursor-not-allowed'
                    : 'bg-white border-green-400 text-gray-800'
                  : 'bg-gray-100 border-gray-300 text-gray-500'
                }
              `}
            >
              午餐
              {selectedMealTypes.includes('lunch') && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>

            {/* Dinner */}
            <button
              onClick={() => toggleMealType('dinner')}
              disabled={isMealLocked('dinner')}
              className={`
                relative py-3 rounded-lg text-sm font-medium transition-all border
                ${selectedMealTypes.includes('dinner')
                  ? isMealLocked('dinner')
                    ? 'bg-green-50 border-green-400 text-gray-700 cursor-not-allowed'
                    : 'bg-white border-green-400 text-gray-800'
                  : 'bg-gray-100 border-gray-300 text-gray-500'
                }
              `}
            >
              晚餐
              {selectedMealTypes.includes('dinner') && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Spacing */}
        <div className="h-24"></div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100">
        <div className="px-4 py-2">
          <button
            onClick={handleNext}
            disabled={selectedDates.length === 0 || selectedMealTypes.length === 0}
            className={`
              w-full py-3 rounded-xl font-medium text-base transition-all
              ${selectedDates.length > 0 && selectedMealTypes.length > 0
                ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white hover:from-green-500 hover:to-emerald-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            下一步
          </button>
        </div>
        <div className="flex justify-center pb-[9px]">
          <div className="w-32 h-1 bg-black rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default DateMealSelectionPage;
