/**
 * AppHeader - 应用Header组件
 * 从App.tsx中提取的Header渲染逻辑
 * 符合架构规范：单一职责，减少App.tsx复杂度
 */

import React, { useRef, useLayoutEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronDown, Plus, Menu } from 'lucide-react';
import PlusMenuPopup from './PlusMenuPopup';
import { useProfileBadges } from '../hooks/useProfileBadges';

interface AppHeaderProps {
  currentScreen: 'dashboard' | 'ai' | 'mealplan' | 'profile';
  selectedDate: Date;
  showCalendar: boolean;
  onDateClick: () => void;
  onBackClick: () => void;
  onOpenLeftDrawer?: () => void;
  onScan?: () => void;
  onBindDevice?: () => void;
  onProductIntro?: () => void;
  onShare?: () => void;
  formatDate: (date: Date) => string;
  generateCalendarDays: () => Date[];
  isToday: (date: Date) => boolean;
  isSameMonth: (date: Date) => boolean;
  onCalendarDateSelect: (date: Date) => void;
  onCalendarClose: () => void;
  onCalendarMonthChange: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentScreen,
  selectedDate,
  showCalendar,
  onDateClick,
  onBackClick,
  formatDate,
  generateCalendarDays,
  isToday,
  isSameMonth,
  onCalendarDateSelect,
  onCalendarClose,
  onCalendarMonthChange,
  onGoToToday,
  onOpenLeftDrawer,
  onScan,
  onBindDevice,
  onProductIntro,
  onShare,
}) => {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const { profileBadge } = useProfileBadges();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isViewingCurrentOrFutureMonth =
    selectedDate.getFullYear() > today.getFullYear() ||
    (selectedDate.getFullYear() === today.getFullYear() &&
      selectedDate.getMonth() >= today.getMonth());

  useLayoutEffect(() => {
    const applyHeaderHeight = () => {
      const el = headerRef.current;
      if (el) {
        const h = el.clientHeight;
        document.documentElement.style.setProperty('--app-header-height', `${h}px`);
      }
    };
    applyHeaderHeight();
    window.addEventListener('resize', applyHeaderHeight);
    return () => window.removeEventListener('resize', applyHeaderHeight);
  }, [currentScreen]);

  return (
    <>
      {/* Unified Header for all navigation pages */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-transparent">
        <div 
          ref={headerRef} 
          className={`w-full max-w-sm mx-auto app-header-shell-fullscreen ${
            currentScreen === 'dashboard' 
              ? 'bg-gradient-to-br from-purple-200 via-purple-100 to-purple-50' 
              : 'bg-gradient-to-br from-purple-200 via-purple-100 to-purple-50'
          }`}
        >
          <div className={`app-header-toolbar ${
            currentScreen === 'ai' ? 'pl-6 pr-1' : currentScreen === 'dashboard' ? 'px-4' : 'px-6'
          }`}>
            {currentScreen === 'dashboard' ? (
              <>
                <button onClick={onBackClick} className="p-0.5 shrink-0" aria-label="返回">
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <span className="flex-1 text-center text-base font-normal text-gray-700">健康档案</span>
                <div className="flex items-center shrink-0">
                  <button
                    onClick={onDateClick}
                    className="bg-white/70 px-3 py-1 rounded-lg flex items-center space-x-1 hover:bg-white/80 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">{formatDate(selectedDate)}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </>
            ) : currentScreen === 'ai' ? (
              <>
                <button
                  onClick={onOpenLeftDrawer}
                  className="p-0.5 relative"
                  aria-label="打开侧边栏"
                >
                  <Menu className="w-6 h-6 text-gray-700" />
                  {profileBadge && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>
                <h1 className="text-center text-base font-normal text-gray-700">瑞丹维</h1>
                <div className="relative flex items-center gap-1">
                  <button
                    onClick={() => setShowPlusMenu((v) => !v)}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors relative"
                    title="更多"
                  >
                    <Plus className="w-6 h-6 text-gray-700" />
                  </button>
                  <PlusMenuPopup
                    visible={showPlusMenu}
                    onClose={() => setShowPlusMenu(false)}
                    onScan={onScan}
                    onBindDevice={onBindDevice}
                    onProductIntro={onProductIntro}
                    onShare={onShare}
                    position="absolute"
                  />
                </div>
              </>
            ) : (
              <>
                <button onClick={onBackClick} className="p-0.5" aria-label="返回">
                  <ChevronLeft className="w-6 h-6 text-gray-700" />
                </button>
                <span className="flex-1 text-center text-base text-gray-800">
                  {currentScreen === 'mealplan' ? '瑞丹维专属方案' : '我的'}
                </span>
                <div className="w-6" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Modal */}
      {showCalendar && (
        <div className="absolute inset-0 z-[55]" onClick={onCalendarClose}>
          <div 
            className="absolute top-20 right-4 bg-white rounded-xl p-3 shadow-lg w-64 animate-in slide-in-from-top-2 duration-200 z-[60]" 
            onClick={(e) => e.stopPropagation()}
            style={{
              transformOrigin: 'top right'
            }}
          >
            {/* Calendar Header */}
            <div className="flex justify-between items-center mb-3">
              <button 
                onClick={() => onCalendarMonthChange('prev')}
                className="p-1 hover:bg-gray-100 rounded-md"
              >
                ←
              </button>
              <h3 className="text-base font-semibold">
                {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月
              </h3>
              <button 
                onClick={() => onCalendarMonthChange('next')}
                disabled={isViewingCurrentOrFutureMonth}
                className={`p-1 rounded-md ${
                  isViewingCurrentOrFutureMonth
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'hover:bg-gray-100'
                }`}
              >
                →
              </button>
            </div>

            {/* Week Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
                <div key={day} className="text-center text-xs text-gray-500 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {generateCalendarDays().map((date, index) => {
                const normalizedDate = new Date(date);
                normalizedDate.setHours(0, 0, 0, 0);
                const isFutureDate = normalizedDate.getTime() > today.getTime();
                const inCurrentMonth = isSameMonth(date);
                const isTodayDate = isToday(date);

                return (
                  <button
                    key={index}
                    disabled={isFutureDate}
                    onClick={() => {
                      if (!isFutureDate) onCalendarDateSelect(date);
                    }}
                    className={`
                      aspect-square rounded-md flex items-center justify-center text-xs transition-all
                      ${isFutureDate
                        ? 'text-gray-300 cursor-not-allowed'
                        : isTodayDate
                          ? 'bg-purple-500 text-white font-semibold'
                          : inCurrentMonth
                            ? 'text-gray-800 hover:bg-purple-100'
                            : 'text-gray-300 hover:bg-gray-100'
                      }
                    `}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Today Button */}
            <div className="mt-3 flex justify-center">
              <button 
                onClick={onGoToToday}
                className={`px-3 py-1 rounded-lg flex items-center space-x-1 transition-colors ${
                  formatDate(selectedDate) === '回今天' 
                    ? 'bg-blue-500 text-white hover:bg-blue-600' 
                    : 'bg-white/70 text-gray-800 hover:bg-white/80'
                }`}
              >
                回到今天
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

