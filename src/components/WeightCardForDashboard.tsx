import React from 'react';
import DashboardCard from './common/DashboardCard';

interface WeightCardForDashboardProps {
  data: {
    current: number | null;
    target: number;
    hasRecord: boolean;
  };
  onCardClick?: () => void;
  onPlusClick?: () => void;
  isShrunk?: boolean;
}

const WeightCardForDashboard: React.FC<WeightCardForDashboardProps> = ({
  data,
  onCardClick,
  onPlusClick,
  isShrunk,
}) => {
  return (
    <DashboardCard
      title="体重"
      showPlus={true}
      onCardClick={onCardClick}
      onPlusClick={onPlusClick}
      isShrunk={isShrunk}
    >
      {/* Weight Display */}
      <div className="mb-4">
        <div className="text-2xl font-bold text-gray-800">
          {data.current ? `${data.current}kg` : '----'}
        </div>
        <div className="text-sm text-gray-400">/ {data.target}kg</div>
      </div>

      {/* No Records Message */}
      <div className="text-center text-gray-400 text-sm mb-4">
        {data.hasRecord ? '体重记录已更新' : '暂无体重记录'}
      </div>

      {/* Progress Track */}
      <div className="relative">
        <div className="flex justify-between items-center">
          <div className="flex space-x-3">
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          </div>
        </div>
        <div className="h-px bg-gray-200 mt-2"></div>
      </div>
    </DashboardCard>
  );
};

export default WeightCardForDashboard;
















