import React, { useState, useEffect } from 'react';
import { nutritionSyncService } from '../services/nutritionSyncService';
import { dashboardDataService } from '../services/dashboardDataService';

const CalorieCard: React.FC = () => {
  const [totalCalories, setTotalCalories] = useState(2000);
  const [foodIntake, setFoodIntake] = useState(0);
  const [exerciseBurned, setExerciseBurned] = useState(0);
  const [remainingCalories, setRemainingCalories] = useState(2000);

  useEffect(() => {
    loadCalorieData();
  }, []);

  const loadCalorieData = async () => {
    try {
      // 统一从dashboard数据服务获取当日数据
      const today = new Date();
      const dayData = await dashboardDataService.getDayHealthData(today);

      const tdee = dayData ? (dayData as any).calories?.total || 2000 : 2000;
      setTotalCalories(tdee);

      // 获取今日食物摄入
      const nutritionTotals = await nutritionSyncService.getDailyNutritionTotals(today);
      const intake = nutritionTotals.totalCalories || 0;
      setFoodIntake(intake);

      // 获取今日运动消耗（统一口径）
      const burned = dayData.exercise.totalCalories || 0;
      setExerciseBurned(Math.round(burned));

      // 计算能量缺口: TDEE - 食物摄入 + 运动消耗
      const remaining = tdee - intake + burned;
      setRemainingCalories(Math.round(remaining));
    } catch (error) {
      console.error('Error loading calorie data:', error);
    }
  };

  return (
    <div className="bg-white/60 rounded-2xl p-6">
      <div className="text-lg font-medium text-gray-700 mb-4">饮食&运动</div>
      
      {/* Circular Progress */}
      <div className="relative flex items-center justify-center mb-6">
        <div className="w-32 h-32 rounded-full bg-white/80 flex flex-col items-center justify-center relative">
          {/* Progress Circle */}
          <svg className="absolute inset-0 w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="#c084fc"
              strokeWidth="8"
            />
            <circle
              cx="64"
              cy="64"
              r="56"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="8"
              strokeDasharray={351.86}
              strokeDashoffset={200}
              strokeLinecap="round"
            />
          </svg>

          <div className="text-xs text-gray-500 mb-0.5">能量缺口</div>
          <div className="text-2xl font-bold text-gray-800">{remainingCalories}</div>
          <div className="text-xs text-gray-400">/{totalCalories}kcal</div>
        </div>

        {/* White dot indicator */}
        <div className="absolute top-8 right-8 w-3 h-3 bg-white rounded-full shadow-sm"></div>
      </div>

      {/* Food and Exercise Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/60 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">食物摄入</div>
          <div className="text-lg font-bold text-gray-800">{foodIntake}<span className="text-xs font-normal text-gray-400">kcal</span></div>
        </div>
        <div className="bg-white/60 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">运动消耗</div>
          <div className="text-lg font-bold text-gray-800">{exerciseBurned}<span className="text-xs font-normal text-gray-400">kcal</span></div>
        </div>
      </div>
    </div>
  );
};

export default CalorieCard;