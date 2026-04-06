import React from 'react';
import DashboardCard from './common/DashboardCard';

interface CaloriesCardProps {
  realTimeFoodIntake: number;
  totalExerciseCalories: number;
  netCalories: number;
  calorieProgress: number;
  onCardClick?: () => void;
  onAIChatClick?: () => void;
  isShrunk?: boolean;
}

const CaloriesCard: React.FC<CaloriesCardProps> = ({
  realTimeFoodIntake,
  totalExerciseCalories,
  netCalories,
  calorieProgress,
  onCardClick,
  isShrunk,
}) => {
  return (
    <DashboardCard
      title="饮食&运动"
      onCardClick={onCardClick}
      isShrunk={isShrunk}
    >
      {/* Circular Progress */}
      <div className="relative flex justify-center mb-6 z-0">
        <div className="w-28 h-28 rounded-full bg-white/60 flex flex-col items-center justify-center relative">
          {/* Progress Circle */}
          <svg className="absolute inset-0 w-28 h-28 transform -rotate-90" viewBox="0 0 112 112">
            <circle
              cx="56"
              cy="56"
              r="48"
              fill="none"
              stroke="#c084fc"
              strokeWidth="6"
            />
            <circle
              cx="56"
              cy="56"
              r="48"
              fill="none"
              stroke="#059669"
              strokeWidth="6"
              strokeDasharray={301.59}
              strokeDashoffset={301.59 - (calorieProgress / 100) * 301.59}
              strokeLinecap="round"
            />
          </svg>

          <div className="text-xs text-gray-500 mb-0.5">能量缺口</div>
          <div className="text-2xl font-bold" style={{ color: netCalories >= 0 ? '#10B981' : '#EF4444' }}>
            {netCalories > 0 ? '+' : ''}{netCalories}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">kcal</div>
        </div>
      </div>

      {/* Food and Exercise Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">食物摄入</div>
          <div className="text-lg font-bold text-gray-800">
            {Math.round(realTimeFoodIntake)}
            <span className="text-xs font-normal text-gray-400">kcal</span>
          </div>
        </div>
        <div className="bg-white/50 rounded-xl p-3 text-center">
          <div className="text-xs text-gray-500 mb-1">运动消耗</div>
          <div className="text-lg font-bold text-gray-800">
            {totalExerciseCalories}
            <span className="text-xs font-normal text-gray-400">kcal</span>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
};

export default CaloriesCard;
















