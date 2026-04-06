import React from 'react';
import DashboardCard from './common/DashboardCard';

interface ExerciseCardProps {
  data: {
    calories?: number;
    minutes?: number;
  };
  onCardClick?: () => void;
  isShrunk?: boolean;
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({
  data,
  onCardClick,
  isShrunk,
}) => {
  return (
    <DashboardCard
      title="运动"
      onCardClick={onCardClick}
      isShrunk={isShrunk}
    >
      <div className="relative h-8 mb-4 bg-gray-100 p-2">
        <svg className="w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
          <polyline
            points="0,60 30,50 60,40 90,20 120,40 150,50 180,60 200,60"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="text-3xl font-bold text-gray-800 mb-1">
        {data.calories || 0} <span className="text-xl">kcal</span>
      </div>
      <div className="text-sm text-gray-400">
        {data.minutes || 0} 分钟
      </div>
    </DashboardCard>
  );
};

export default ExerciseCard;
















