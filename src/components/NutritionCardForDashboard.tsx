import React from 'react';
import DashboardCard from './common/DashboardCard';

interface NutritionCardForDashboardProps {
  data: {
    carbs: { current: number; target: number };
    protein: { current: number; target: number };
    fat: { current: number; target: number };
  };
  onCardClick?: () => void;
  isShrunk?: boolean;
}

const NutritionCardForDashboard: React.FC<NutritionCardForDashboardProps> = ({
  data,
  onCardClick,
  isShrunk,
}) => {
  return (
    <DashboardCard
      title="营养素"
      onCardClick={onCardClick}
      isShrunk={isShrunk}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
            <span className="text-sm text-gray-600">碳水</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-gray-800">{data.carbs.current}</span>
            <span className="text-xs text-gray-400">/{data.carbs.target}g</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-red-400"></div>
            <span className="text-sm text-gray-600">蛋白质</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-gray-800">{data.protein.current}</span>
            <span className="text-xs text-gray-400">/{data.protein.target}g</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span className="text-sm text-gray-600">脂肪</span>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold text-gray-800">{data.fat.current}</span>
            <span className="text-xs text-gray-400">/{data.fat.target}g</span>
          </div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
        <div 
          className="h-2 rounded-full bg-gradient-to-r from-yellow-400 via-red-400 to-blue-400" 
          style={{ width: `${Math.min(100, (data.carbs.current + data.protein.current + data.fat.current) / (data.carbs.target + data.protein.target + data.fat.target) * 100)}%` }}
        ></div>
      </div>
    </DashboardCard>
  );
};

export default NutritionCardForDashboard;
















