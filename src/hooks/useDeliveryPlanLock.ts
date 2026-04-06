/**
 * useDeliveryPlanLock - 配送计划锁定逻辑Hook
 * 从DeliveryPlanPage.tsx中提取的锁定逻辑
 * 符合架构规范：单一职责，减少组件复杂度
 */

import { getDeliveryMealTimeRange } from '../constants/deliveryMealTimes';

interface UseDeliveryPlanLockOptions {
  lockedMeals: Set<string>;
  manuallyModifiedMeals: Set<string>;
  getMealKey: (date: Date, mealType: string) => string;
}

export function useDeliveryPlanLock({
  lockedMeals,
  manuallyModifiedMeals,
  getMealKey,
}: UseDeliveryPlanLockOptions) {
  void manuallyModifiedMeals;
  // 检查是否自动锁定（基于配送时间）
  const isAutoLocked = (date: Date, mealType: string): boolean => {
    const now = new Date();
    const deliveryDate = new Date(date);

    const startTime = getDeliveryMealTimeRange(mealType).start;
    const [hours, minutes] = startTime.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
    deliveryDate.setHours(hours, minutes, 0, 0);

    // Calculate 1 hour before delivery
    const lockTime = new Date(deliveryDate.getTime() - 60 * 60 * 1000);

    return now >= lockTime;
  };

  // 检查是否手动锁定
  const isManuallyLocked = (date: Date, mealType: string): boolean => {
    const mealKey = getMealKey(date, mealType);
    return lockedMeals.has(mealKey);
  };

  // 检查是否锁定（手动或自动）
  const isMealLocked = (date: Date, mealType: string): boolean => {
    return isManuallyLocked(date, mealType) || isAutoLocked(date, mealType);
  };

  // 获取日期锁定状态
  const getDayLockStatus = (date: Date, dateConfigs: Array<{ mealType: string }>): 'full' | 'partial' | 'none' => {
    if (dateConfigs.length === 0) return 'none';

    const lockedCount = dateConfigs.filter(config => 
      isMealLocked(date, config.mealType)
    ).length;

    if (lockedCount === 0) return 'none';
    if (lockedCount === dateConfigs.length) return 'full';
    return 'partial';
  };

  return {
    isAutoLocked,
    isManuallyLocked,
    isMealLocked,
    getDayLockStatus,
  };
}




















