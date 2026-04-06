/**
 * useCalendarLogic - 日历相关逻辑Hook
 * 从App.tsx中提取的日历相关函数
 */

export function useCalendarLogic(selectedDate: Date) {
  const formatDate = (date: Date) => {
    const targetDate = new Date(date);
    return `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;
  };

  const generateCalendarDays = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Day of week for first day (0 = Sunday, 6 = Saturday)
    const startDay = firstDay.getDay();
    
    // Days in the month
    const daysInMonth = lastDay.getDate();
    
    const days: Date[] = [];
    
    // Add days from previous month to fill the first week
    const prevMonth = new Date(year, month - 1, 0);
    const daysInPrevMonth = prevMonth.getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, daysInPrevMonth - i));
    }
    
    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Add days from next month to fill the last week (to make 6 weeks total)
    const remainingDays = 42 - days.length; // 6 weeks * 7 days = 42
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSameMonth = (date: Date, referenceDate: Date = selectedDate) => {
    return date.getMonth() === referenceDate.getMonth() &&
           date.getFullYear() === referenceDate.getFullYear();
  };

  return {
    formatDate,
    generateCalendarDays,
    isToday,
    isSameMonth,
  };
}




