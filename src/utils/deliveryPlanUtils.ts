/**
 * deliveryPlanUtils - 配送计划工具函数
 * 从DeliveryPlanPage.tsx中提取的工具函数
 * 符合架构规范：单一职责，代码复用
 */

import { toLocalDateString } from './dateUtils';

export const getMealTypeLabel = (mealType: string): string => {
  const labels: Record<string, string> = {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐'
  };
  return labels[mealType] || mealType;
};

export const getMealTimeRange = (mealType: string): string => {
  const timeRanges: Record<string, string> = {
    breakfast: '6:30-7:30',
    lunch: '11:30-12:30',
    dinner: '17:30-18:30'
  };
  return timeRanges[mealType] || '';
};

export const getDateLabel = (date: Date): string => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  return `${month}/${day} ${weekday}`;
};

export const getDateLabelFull = (date: Date): string => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekday = weekdays[date.getDay()];
  return `${year}-${month}-${day} ${weekday}`;
};

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getMealKey = (date: Date, mealType: string): string => {
  const dateStr = toLocalDateString(date);
  return `${dateStr}-${mealType}`;
};

/**
 * 当前业务日（与 toLocalDateString 一致）落在配送列表的哪一周，用于默认选中「第一周/第二周/…」或「余X天」。
 * 今日不在列表或列表为空时返回 cycle-0。
 */
export function getDefaultCycleTabIdForToday(selectedDates: Date[]): string {
  if (!selectedDates?.length) return 'cycle-0';

  const todayStr = toLocalDateString(new Date());
  const idx = selectedDates.findIndex((d) => toLocalDateString(d) === todayStr);
  if (idx < 0) return 'cycle-0';

  const totalDays = selectedDates.length;
  const fullCycles = Math.floor(totalDays / 7);
  const remainingDays = totalDays % 7;

  if (remainingDays > 0 && idx >= fullCycles * 7) {
    return 'remainder';
  }

  return `cycle-${Math.floor(idx / 7)}`;
}




















