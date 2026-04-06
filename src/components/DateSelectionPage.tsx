 
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { UserPackage, MockPackageData, calculatePackageDates } from '../services/packageService';
import { DrawerScreen } from './common/DrawerScreen';
import { SecondaryPageHeader } from './common/SecondaryPageHeader';

interface DateSelectionPageProps {
  onClose: () => void;
  onNext: (selectedDates: Date[], excludedDates: Date[], selectedMealTypes: string[]) => void;
  packageData?: UserPackage | MockPackageData | null;
  initialSelectedDates?: Date[];
  initialExcludedDates?: Date[];
  initialSelectedMealTypes?: string[];
}

const DateSelectionPage: React.FC<DateSelectionPageProps> = ({
  onClose,
  onNext,
  packageData,
  initialSelectedDates,
  initialExcludedDates,
  initialSelectedMealTypes
}) => {
  const packageDuration = packageData?.package_duration || 7; // 测试演示用，正常情况下无订单无法配置
  const includedMeals = packageData?.included_meals || ['breakfast', 'lunch', 'dinner'];
  const normalizeToIncluded = (input?: string[] | null): string[] => {
    const source = Array.isArray(input) ? input : [];
    const includedSet = new Set(includedMeals.map((m) => String(m).toLowerCase()));
    const filtered = source
      .map((m) => String(m).toLowerCase())
      .filter((m) => includedSet.has(m));
    return filtered.length > 0 ? filtered : includedMeals;
  };

  const [selectedDates, setSelectedDates] = useState<Date[]>(initialSelectedDates || []);
  const [selectedMealTypes] = useState<string[]>(normalizeToIncluded(initialSelectedMealTypes));
  const [excludedDates, setExcludedDates] = useState<Date[]>(initialExcludedDates || []);
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  const [lastClickedDate, setLastClickedDate] = useState<Date | null>(null);
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
    for (let i = 1; i <= lastDayOfMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      date.setHours(0, 0, 0, 0);
      dates.push(date);
    }
    return dates;
  };

  const handlePrevMonth = () => {
    const now = new Date();
    const currentMonthValue = now.getMonth();
    if (currentMonth === currentMonthValue) {
      return;
    }
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    const now = new Date();
    const currentMonthValue = now.getMonth();
    const currentYearValue = now.getFullYear();
    let nextMonth = currentMonthValue + 1;
    let nextYear = currentYearValue;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    if (currentMonth === nextMonth && currentYear === nextYear) {
      return;
    }
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

  const isDateInPackage = (date: Date) => {
    const isSelected = selectedDates.some(d => d.toDateString() === date.toDateString());
    const isExcluded = excludedDates.some(d => d.toDateString() === date.toDateString());
    return isSelected && !isExcluded;
  };

  const handleDateClick = (clickedDate: Date) => {
    const now = Date.now();
    const isDoubleClick =
      lastClickedDate &&
      lastClickedDate.toDateString() === clickedDate.toDateString() &&
      now - lastClickTime < 300;

    setLastClickTime(now);
    setLastClickedDate(clickedDate);

    // Handle double-click on selected date to exclude it
    if (isDoubleClick && isDateInPackage(clickedDate)) {
      if (excludedDates.length >= 3) {
        console.log('❌ 最多只能取消3天');
        return;
      }
      const newExcludedDates = [...excludedDates, clickedDate];
      setExcludedDates(newExcludedDates);
      if (selectedDates.length > 0) {
        const lastDate = selectedDates[selectedDates.length - 1];
        const nextDate = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() + 1);
        setSelectedDates([...selectedDates, nextDate]);
      }
      console.log('✅ 取消日期:', clickedDate.toDateString());
      console.log('📅 已取消天数:', newExcludedDates.length);
      return;
    }

    // Single click: only set new start date if no dates selected, or if clicking on an unselected date
    if (selectedDates.length === 0 || !isDateInPackage(clickedDate)) {
      const newSelectedDates: Date[] = [];
      for (let i = 0; i < packageDuration; i++) {
        const date = new Date(clickedDate);
        date.setDate(clickedDate.getDate() + i);
        newSelectedDates.push(date);
      }
      setSelectedDates(newSelectedDates);
      setExcludedDates([]);
    }
  };

  const isDatePastOrToday = (date: Date) => {
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate < today;
  };

  const toggleMealType = (mealType: string) => {
    // 餐次严格跟随订单商品配置：不允许新增或取消。
    if (!includedMeals.includes(mealType)) return;
  };

  const isMealLocked = (mealType: string) => {
    return includedMeals.includes(mealType);
  };

  const isMealDisabled = (mealType: string) => {
    return !includedMeals.includes(mealType) || isMealLocked(mealType);
  };

  const isValid = () => {
    return selectedDates.length > 0 && selectedMealTypes.length > 0;
  };

  const handleNext = () => {
    if (isValid()) {
      onNext(selectedDates, excludedDates, selectedMealTypes);
    }
  };

  const allDates = generateAllAvailableDates();
  const dateGroups = groupDatesByMonth(allDates);

  return (
    <DrawerScreen show={true} onClose={onClose} showDragHandle={false}>
      <div className="flex flex-col h-full bg-white overflow-hidden">
        {/* Header */}
        <SecondaryPageHeader 
          title="选择开始日期" 
          onClose={onClose} 
        />

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="ml-4 mr-4 mt-[5px] px-4 py-3 bg-white border border-gray-300 rounded-lg">
            <div className="flex items-center justify-between mb-2">
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

            <div className="grid grid-cols-7 gap-0 mb-1">
              {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((day) => (
                <div key={day} className="text-center text-xs text-gray-500 font-medium py-0.5">
                  {day}
                </div>
              ))}
            </div>

            {dateGroups.length > 0 && (
              <div className="grid grid-cols-7 gap-x-0 gap-y-0 mb-1.5">
                {dateGroups[0].allDates.map((date, index) => {
                  const isSelected = isDateInPackage(date);
                  const isExcluded = excludedDates.some(d => d.toDateString() === date.toDateString());
                  const isPastOrToday = isDatePastOrToday(date);
                  const isInCurrentMonth = date.getMonth() === dateGroups[0].month;
                  const isAvailableDate = dateGroups[0].dates.some(d => d.toDateString() === date.toDateString());

                  return (
                    <button
                      key={index}
                      disabled={isPastOrToday || !isAvailableDate}
                      onClick={() => !isPastOrToday && isAvailableDate && handleDateClick(date)}
                      className={`
                        aspect-square flex items-center justify-center text-sm font-medium relative py-0
                        ${isPastOrToday || !isAvailableDate
                          ? 'text-gray-300 cursor-not-allowed'
                          : isSelected
                            ? 'text-green-600 font-semibold'
                            : isExcluded
                              ? 'text-red-400 line-through'
                              : isInCurrentMonth
                                ? 'text-gray-800'
                                : 'text-gray-400'
                        }
                      `}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-green-100"></div>
                        </div>
                      )}
                      {isExcluded && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-red-100"></div>
                        </div>
                      )}
                      <span className="relative z-10">{date.getDate()}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="border-t border-gray-300 my-2"></div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-6">
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
              {selectedDates.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedDates([]);
                    setExcludedDates([]);
                  }}
                  className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  重置
                </button>
              )}
            </div>
            {excludedDates.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                已取消 {excludedDates.length} 天，剩余 {selectedDates.length - excludedDates.length} 天配送 {excludedDates.length < 3 && `(最多可取消${3 - excludedDates.length}天)`}
              </div>
            )}
            {selectedDates.length > 0 && excludedDates.length === 0 && (
              <div className="mt-2 text-xs text-gray-400">
                💡 双击已选日期可取消该天配送（最多3天）
              </div>
            )}
          </div>

          <div className="px-4 py-2 mt-1">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => toggleMealType('breakfast')}
                disabled={isMealDisabled('breakfast')}
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

              <button
                onClick={() => toggleMealType('lunch')}
                disabled={isMealDisabled('lunch')}
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

              <button
                onClick={() => toggleMealType('dinner')}
                disabled={isMealDisabled('dinner')}
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

          <div className="h-24"></div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 bg-white px-4 py-3">
          <button
            onClick={handleNext}
            disabled={!isValid()}
            className={`
              w-full py-3 rounded-xl font-medium text-base transition-all
              ${isValid()
                ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white hover:from-green-500 hover:to-emerald-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            确定
          </button>
        </div>
      </div>
    </DrawerScreen>
  );
};

export default DateSelectionPage;
