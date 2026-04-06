/**
 * useAppNavigation - 应用导航和日期状态管理Hook
 * 从App.tsx中提取的导航和日期相关状态管理逻辑
 * 符合架构规范：提取状态管理逻辑，减少App.tsx复杂度
 */

import { useState } from 'react';

export type ScreenType = 'dashboard' | 'ai' | 'mealplan' | 'profile';

export interface AppNavigationState {
  currentScreen: ScreenType;
  showCalendar: boolean;
  selectedDate: Date;
  displayedWeekStart: Date;
  /** 单日对话视图：从左侧抽屉选择某天后使用 */
  chatSelectedDate: Date | null;
}

export interface AppNavigationActions {
  setCurrentScreen: (screen: ScreenType) => void;
  setShowCalendar: (show: boolean) => void;
  setSelectedDate: (date: Date) => void;
  setDisplayedWeekStart: (date: Date) => void;
  setChatSelectedDate: (date: Date | null) => void;
  navigateToScreen: (screen: ScreenType) => void;
}

export function useAppNavigation() {
  const [currentScreen, setCurrentScreenState] = useState<ScreenType>('ai');
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [displayedWeekStart, setDisplayedWeekStart] = useState(new Date());
  const [chatSelectedDate, setChatSelectedDate] = useState<Date | null>(null);

  const setCurrentScreen = (screen: ScreenType) => {
    setCurrentScreenState((prev) => {
      // 健康档案首页默认回到当天
      if (screen === 'dashboard' && prev !== 'dashboard') {
        const today = new Date();
        setSelectedDate(today);
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        setDisplayedWeekStart(weekStart);
      }
      return screen;
    });
  };

  const navigateToScreen = (screen: ScreenType) => {
    setCurrentScreen(screen);
    setShowCalendar(false);
  };

  return {
    // State
    currentScreen,
    showCalendar,
    selectedDate,
    displayedWeekStart,
    chatSelectedDate,

    // Actions
    setCurrentScreen,
    setShowCalendar,
    setSelectedDate,
    setDisplayedWeekStart,
    setChatSelectedDate,
    navigateToScreen,
  };
}
