/**
 * useAppFoodDetail - 食物详情和营养详情状态管理Hook
 * 从App.tsx中提取的食物详情相关状态管理逻辑
 * 符合架构规范：提取状态管理逻辑，减少App.tsx复杂度
 */

import { useState } from 'react';

export interface AppFoodDetailState {
  foodDetailScreenDate: Date;
  nutritionRefreshKey: number;
}

export interface AppFoodDetailActions {
  setFoodDetailScreenDate: (date: Date) => void;
  setNutritionRefreshKey: (key: number | ((prev: number) => number)) => void;
  refreshNutrition: () => void;
}

export function useAppFoodDetail() {
  const [foodDetailScreenDate, setFoodDetailScreenDate] = useState<Date>(new Date());
  const [nutritionRefreshKey, setNutritionRefreshKey] = useState(0);

  const refreshNutrition = () => {
    setNutritionRefreshKey(prev => prev + 1);
  };

  return {
    // State
    foodDetailScreenDate,
    nutritionRefreshKey,
    
    // Actions
    setFoodDetailScreenDate,
    setNutritionRefreshKey,
    refreshNutrition,
  };
}

















