import React from 'react';
import DashboardCard from './common/DashboardCard';

interface WaterCardForDashboardProps {
  data: {
    current: number;
    target: number;
  };
  waterProgress: number;
  onCardClick?: () => void;
  onPlusClick?: () => void;
  isShrunk?: boolean;
}

const WaterCardForDashboard: React.FC<WaterCardForDashboardProps> = ({
  data,
  waterProgress,
  onCardClick,
  onPlusClick,
  isShrunk,
}) => {
  return (
    <DashboardCard
      title="喝水"
      showPlus={true}
      onCardClick={onCardClick}
      onPlusClick={onPlusClick}
      isShrunk={isShrunk}
    >
      {/* Time Labels */}
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>0:00</span>
        <span>12:00</span>
        <span>24:00</span>
      </div>

      {/* Current Intake */}
      <div className="text-center mb-4">
        <div className="text-3xl font-bold text-gray-800 mb-1">{data.current}</div>
        <div className="text-sm text-gray-500">目标 {data.target}ml</div>
      </div>

      {/* Water Progress Visualization */}
      <div className="flex justify-center">
        <div className="w-12 h-16 bg-blue-100 rounded-lg relative overflow-hidden">
          <div 
            className="absolute bottom-0 left-0 right-0 bg-blue-400 transition-all duration-300"
            style={{ height: `${Math.min(100, waterProgress)}%` }}
          ></div>
        </div>
      </div>
    </DashboardCard>
  );
};

export default WaterCardForDashboard;
















