import React from 'react';
import DashboardCard from './common/DashboardCard';
import { calculateStepsData } from '../services/calorieCalculations';

interface StepsCardProps {
  data: {
    current: number;
    floors: number;
    hourlyData: number[];
  };
  userWeight: number;
  onCardClick?: () => void;
  onPlusClick?: () => void;
  isShrunk?: boolean;
}

const StepsCard: React.FC<StepsCardProps> = ({
  data,
  userWeight,
  onCardClick,
  onPlusClick,
  isShrunk,
}) => {
  const stepsData = calculateStepsData(data.current, data.floors, userWeight);

  return (
    <DashboardCard
      title="步数"
      showPlus={true}
      onCardClick={onCardClick}
      onPlusClick={onPlusClick}
      isShrunk={isShrunk}
    >
      <div className="relative h-8 mb-4 bg-gray-100 p-2">
        <div className="flex items-end justify-between h-full">
          {data.hourlyData.map((steps, index) => {
            const maxHourlySteps = Math.max(...data.hourlyData);
            const heightPercent = maxHourlySteps > 0 ? (steps / maxHourlySteps) * 100 : 0;
            return (
              <div
                key={index}
                className="bg-orange-400 flex-1 mx-0.5"
                style={{ height: `${Math.max(2, (heightPercent / 100) * 100)}%`, width: '2px' }}
              ></div>
            );
          })}
        </div>
      </div>

      <div className="text-3xl font-bold text-gray-800 mb-1">
        {stepsData.totalCalories} <span className="text-xl">kcal</span>
      </div>
      <div className="text-sm text-gray-400">{data.current}步</div>
    </DashboardCard>
  );
};

export default StepsCard;
















