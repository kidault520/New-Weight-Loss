/**
 * useDateSelection - 日期选择和管理Hook
 * 从App.tsx中提取的日期相关逻辑
 */

import { useState, useCallback } from 'react';
import { toLocalDateString } from '../utils/dateUtils';

export function useDateSelection(initialDate?: Date) {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate || new Date());
  const [displayedWeekStart, setDisplayedWeekStart] = useState<Date>(() => {
    const today = initialDate || new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    return weekStart;
  });
  const [showCalendar, setShowCalendar] = useState(false);

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
    // 更新周视图起始日期
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    setDisplayedWeekStart(weekStart);
  }, []);

  const handleWeekStartChange = useCallback((date: Date) => {
    setDisplayedWeekStart(date);
  }, []);

  const formatDateKey = useCallback((date: Date) => {
    return toLocalDateString(date);
  }, []);

  const formatDate = useCallback((date: Date) => {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return '今日';
    }
    return '回今天';
  }, []);

  const isToday = useCallback((date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }, []);

  const isSameMonth = useCallback((date: Date, compareDate: Date) => {
    return date.getMonth() === compareDate.getMonth() && 
           date.getFullYear() === compareDate.getFullYear();
  }, []);

  const generateCalendarDays = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  }, []);

  const goToToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    handleDateChange(today);
  }, [handleDateChange]);

  return {
    selectedDate,
    displayedWeekStart,
    showCalendar,
    setSelectedDate: handleDateChange,
    setDisplayedWeekStart: handleWeekStartChange,
    setShowCalendar,
    formatDateKey,
    formatDate,
    isToday,
    isSameMonth,
    generateCalendarDays,
    goToToday,
  };
}




