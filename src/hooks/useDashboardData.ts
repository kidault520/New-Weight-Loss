/**
 * useDashboardData - Dashboard数据获取和管理Hook（基于React Query）
 * 符合架构规范：组件 → Hook → Supabase (3层)
 * 
 * 重构说明：
 * - 使用 React Query 管理数据获取和缓存
 * - 自动响应相关数据变更（通过 invalidateQueries）
 * - 保留 userDayDataOverrides 功能用于本地覆盖
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DayData } from '../utils/mockData';
import { generateMockData } from '../utils/mockData';
import { dashboardDataService } from '../services/dashboardDataService';
import { UserProfile, calculateBMR } from '../utils/bmrCalculations';
import { useState } from 'react';
import { toLocalDateString } from '../utils/dateUtils';

interface UseDashboardDataOptions {
  userId: string | null;
  selectedDate: Date;
  profile: UserProfile | null;
  showOnboarding?: boolean;
}

/**
 * 格式化日期为 YYYY-MM-DD 格式的 key
 */
function formatDateKey(date: Date): string {
  return toLocalDateString(date);
}

export function useDashboardData({
  userId,
  selectedDate,
  profile,
  showOnboarding = false,
}: UseDashboardDataOptions) {
  const queryClient = useQueryClient();
  
  // 保留 userDayDataOverrides 用于本地覆盖（如快速编辑、临时修改等）
  const [userDayDataOverrides, setUserDayDataOverrides] = useState<Record<string, Partial<DayData>>>({});

  // 格式化日期 key
  const dateKey = formatDateKey(selectedDate);

  // 使用 React Query 管理 Dashboard 数据
  const dashboardQuery = useQuery({
    queryKey: [
      'dashboard-data',
      userId,
      dateKey,
      showOnboarding,
      profile?.target_weight,
      profile?.daily_steps_goal,
    ],
    queryFn: async () => {
      if (!userId) {
        // 无用户ID时使用mock数据
        return generateMockData(selectedDate);
      }

      const targetWeight = profile?.target_weight || 60;
      try {
        const data = await dashboardDataService.getDayData(selectedDate, {
          showTutorialData: showOnboarding,
          targetWeight: targetWeight,
          userProfile: profile,
        });
        return data;
      } catch (error) {
        console.error('[useDashboardData] Error loading day data:', error);
        // 降级到mock数据
        return generateMockData(selectedDate);
      }
    },
    enabled: true, // 总是启用，即使没有 userId 也返回 mock 数据
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    gcTime: 10 * 60 * 1000, // 10分钟垃圾回收时间
  });

  // 获取当前日期的数据（应用本地覆盖）
  const getCurrentDateData = useCallback((): DayData => {
    const queryData = dashboardQuery.data;
    const userOverrides = userDayDataOverrides[dateKey];

    // 优先使用查询数据
    if (queryData) {
      if (userOverrides) {
        // 应用本地覆盖；mealIntakeStatus 取并集（今日餐与餐食方案两处完成摄入需全站同步）
        const mergedMealIntakeStatus = {
          ...queryData.mealIntakeStatus,
          ...userOverrides.mealIntakeStatus,
        };
        return {
          ...queryData,
          ...userOverrides,
          mealIntakeStatus: Object.keys(mergedMealIntakeStatus).length > 0 ? mergedMealIntakeStatus : undefined,
          weight: userOverrides.weight ? { ...queryData.weight, ...userOverrides.weight } : queryData.weight,
          water: userOverrides.water ? { ...queryData.water, ...userOverrides.water } : queryData.water,
          steps: userOverrides.steps ? { ...queryData.steps, ...userOverrides.steps } : queryData.steps,
        };
      }
      return queryData;
    }

    // 降级到mock数据
    const mockData = generateMockData(selectedDate);
    if (userOverrides) {
      const finalData = { ...mockData, ...userOverrides };
      
      // 合并weight和water对象
      if (userOverrides.weight) {
        finalData.weight = { ...mockData.weight, ...userOverrides.weight };
      }
      if (userOverrides.water) {
        finalData.water = { ...mockData.water, ...userOverrides.water };
      }
      if (userOverrides.steps) {
        finalData.steps = { ...mockData.steps, ...userOverrides.steps };
      }

      // 计算营养数据
      if (userOverrides.records) {
        const foodRecords = userOverrides.records.filter(record => record.type === 'food');
        const totalCalories = foodRecords.reduce((sum, record) => sum + (record.calories || 0), 0);
        const totalProtein = foodRecords.reduce((sum, record) => sum + (record.nutrition_data?.protein || 0), 0);
        const totalCarbs = foodRecords.reduce((sum, record) => sum + (record.nutrition_data?.carbs || 0), 0);
        const totalFat = foodRecords.reduce((sum, record) => sum + (record.nutrition_data?.fat || 0), 0);

        const bmr = profile ? calculateBMR(profile) : 1500;
        const exBurn = finalData.calories.exerciseBurned;
        finalData.calories = {
          ...finalData.calories,
          foodIntake: totalCalories,
          remaining: Math.round(totalCalories - exBurn - bmr),
        };

        finalData.nutrition = {
          carbs: { current: Math.round(totalCarbs), target: finalData.nutrition.carbs.target },
          protein: { current: Math.round(totalProtein), target: finalData.nutrition.protein.target },
          fat: { current: Math.round(totalFat), target: finalData.nutrition.fat.target }
        };
      }

      return finalData;
    }

    return mockData;
  }, [dashboardQuery.data, selectedDate, userDayDataOverrides, dateKey, profile]);

  // 更新本地覆盖数据
  const updateDayData = useCallback((date: Date, updates: Partial<DayData>) => {
    const updateDateKey = formatDateKey(date);
    setUserDayDataOverrides(prev => ({
      ...prev,
      [updateDateKey]: {
        ...prev[updateDateKey],
        ...updates,
      }
    }));

    // 如果更新的是当前日期，同时失效查询以触发重新获取
    if (updateDateKey === dateKey) {
      queryClient.invalidateQueries({ queryKey: ['dashboard-data', userId, updateDateKey] });
    }
  }, [dateKey, userId, queryClient]);

  // 手动刷新数据（保留接口以保持向后兼容）
  const loadDayData = useCallback((date: Date) => {
    const refreshDateKey = formatDateKey(date);
    queryClient.invalidateQueries({ queryKey: ['dashboard-data', userId, refreshDateKey] });
  }, [userId, queryClient]);

  return {
    realTimeData: dashboardQuery.data || null,
    loadingDayData: dashboardQuery.isLoading,
    userDayDataOverrides,
    setUserDayDataOverrides,
    loadDayData,
    updateDayData,
    getCurrentDateData,
    formatDateKey,
    // 新增：提供 React Query 的原始数据访问
    refetch: dashboardQuery.refetch,
    isError: dashboardQuery.isError,
    error: dashboardQuery.error,
  };
}

